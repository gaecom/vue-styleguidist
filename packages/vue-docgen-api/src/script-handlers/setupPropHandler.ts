import * as bt from '@babel/types'
import { NodePath } from 'ast-types/lib/node-path'
import { visit } from 'recast'
// eslint-disable-next-line import/no-named-default
import type {
	default as Documentation,
	BlockTag,
	DocBlockTags,
	SubProp,
	TypeOfProp
} from '../Documentation'
import { ParseOptions } from '../parse'
import getDocblock from '../utils/getDocblock'
import getDoclets from '../utils/getDoclets'
import transformTagsIntoObject from '../utils/transformTagsIntoObject'
import { describePropsFromValue } from './propHandler'

/**
 * Extract information from an setup-style VueJs 3 component
 * about what props can be used with this component
 * @param {NodePath} astPath
 * @param {Array<NodePath>} componentDefinitions
 * @param {string} originalFilePath
 */
export default async function setupPropHandler(
	documentation: Documentation,
	componentDefinition: NodePath,
	astPath: bt.File,
	opt: ParseOptions
) {
	let propsDef: NodePath<any, any> | undefined
	visit(astPath.program, {
		visitCallExpression(nodePath) {
			if (bt.isIdentifier(nodePath.node.callee) && nodePath.node.callee.name === 'defineProps') {
				propsDef = nodePath.get('arguments', 0)

				if ((nodePath.node as any).typeParameters) {
					const typeParamsPath = nodePath.get('typeParameters', 'params', 0)
					if (bt.isTSTypeLiteral(typeParamsPath.node)) {
						getPropsFromLiteralType(documentation, typeParamsPath.get('members'))
					} else if (
						bt.isTSTypeReference(typeParamsPath.node) &&
						bt.isIdentifier(typeParamsPath.node.typeName)
					) {
						// its a reference to an interface or type
						const typeName = typeParamsPath.node.typeName.name // extract the identifier
						// find it's definition in the file
						const definitionPath = getTypeDefinitionFromIdentifier(astPath, typeName)
						// use the same process to exact info
						if (definitionPath) {
							getPropsFromLiteralType(documentation, definitionPath)
						}
					}
				}
			}
			return false
		}
	})

	// this is JavaScript typing
	if (propsDef) {
		await describePropsFromValue(documentation, propsDef, astPath, opt)
	}
}

function getTypeDefinitionFromIdentifier(astPath: bt.File, typeName: string): NodePath | undefined {
	let typeBody: NodePath | undefined = undefined
	visit(astPath.program, {
		visitTSInterfaceDeclaration(nodePath) {
			if (bt.isIdentifier(nodePath.node.id) && nodePath.node.id.name === typeName) {
				typeBody = nodePath.get('body', 'body')
			}
			return false
		}
	})
	return typeBody
}

function getPropsFromLiteralType(documentation: Documentation, typeParamsPathMembers: any): void {
	typeParamsPathMembers.each((prop: NodePath) => {
		if (bt.isTSPropertySignature(prop.node) && bt.isIdentifier(prop.node.key)) {
			const propDescriptor = documentation.getPropDescriptor(prop.node.key.name)

			decorateItem(prop, propDescriptor)

			propDescriptor.required = !prop.node.optional

			propDescriptor.type = resolveTSType(prop.get('typeAnnotation', 'typeAnnotation'))
		}
	})
}

const PRIMITIVE_MAP = {
	TSBooleanKeyword: 'boolean',
	TSNumberKeyword: 'number',
	TSStringKeyword: 'string'
} as const

function resolveTSType(typeAnnotation: NodePath): TypeOfProp | undefined {
	const primitiveType = PRIMITIVE_MAP[typeAnnotation.node.type as keyof typeof PRIMITIVE_MAP]

	if (primitiveType) {
		return {
			name: primitiveType
		}
	} else if (bt.isTSArrayType(typeAnnotation.node)) {
		const elementType = typeAnnotation.get('elementType')
		if (elementType.node) {
			const tsType = resolveTSType(elementType)
			return {
				name: 'array',
				elements: tsType ? [tsType] : undefined
			}
		}
		return {
			name: 'array'
		}
	} else if (bt.isTSTypeLiteral(typeAnnotation.node)) {
		return {
			name: 'signature',
			properties: typeAnnotation
				.get('members')
				.map((member: NodePath) => {
					if (bt.isTSPropertySignature(member.node) && bt.isIdentifier(member.node.key)) {
						const subProp: SubProp = {
							key: member.node.key.name,
							value: resolveTSType(member.get('typeAnnotation', 'typeAnnotation'))
						}
						decorateItem(member, subProp)
						return subProp
					}
				})
				.filter((p: any) => p)
		}
	} else if (bt.isTSTypeReference(typeAnnotation.node)) {
		// test
	}
}

function decorateItem(
	item: NodePath,
	propDescriptor: { description?: string; tags?: Record<string, BlockTag[]> }
) {
	const docBlock = getDocblock(item)
	const jsDoc: DocBlockTags = docBlock ? getDoclets(docBlock) : { description: '', tags: [] }
	const jsDocTags: BlockTag[] = jsDoc.tags ? jsDoc.tags : []

	if (jsDoc.description) {
		propDescriptor.description = jsDoc.description
	}

	if (jsDocTags.length) {
		propDescriptor.tags = transformTagsIntoObject(jsDocTags)
	}
}
