import * as bt from '@babel/types'
import { NodePath } from 'ast-types/lib/node-path'
import { visit } from 'recast'
import Documentation, { BlockTag, DocBlockTags } from '../Documentation'
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
						typeParamsPath.get('members').each((prop: NodePath) => {
							if (bt.isTSPropertySignature(prop.node) && bt.isIdentifier(prop.node.key)) {
								const propDescriptor = documentation.getPropDescriptor(prop.node.key.name)

								// description
								const docBlock = getDocblock(prop)
								const jsDoc: DocBlockTags = docBlock
									? getDoclets(docBlock)
									: { description: '', tags: [] }
								const jsDocTags: BlockTag[] = jsDoc.tags ? jsDoc.tags : []

								if (jsDoc.description) {
									propDescriptor.description = jsDoc.description
								}

								if (jsDocTags.length) {
									propDescriptor.tags = transformTagsIntoObject(jsDocTags)
								}

								propDescriptor.required = !prop.node.optional

								propDescriptor.type = resolveTSType(prop.get('typeAnnotation', 'typeAnnotation'))
							}
						})
					}
				}
			}
			return false
		}
	})

	if (propsDef) {
		await describePropsFromValue(documentation, propsDef, astPath, opt)
	}
}

function resolveTSType(typeAnnotation: NodePath): any {
	const primitiveType: string | undefined = (
		{
			TSBooleanKeyword: 'boolean',
			TSNumberKeyword: 'number',
			TSStringKeyword: 'string'
		} as const
	)[typeAnnotation.node.type as string]

	if (primitiveType) {
		return {
			name: primitiveType
		}
	} else if (bt.isTSArrayType(typeAnnotation.node)) {
		const elementType = typeAnnotation.get('elementType')
		if (elementType.node) {
			return {
				name: 'array',
				elements: [resolveTSType(elementType)]
			}
		}
		return {
			name: 'array'
		}
	} else if (bt.isTSTypeLiteral(typeAnnotation.node)) {
		return {
			name: 'signature',
			type: 'object',
			properties: typeAnnotation
				.get('members')
				.map((member: NodePath) => {
					if (bt.isTSPropertySignature(member.node) && bt.isIdentifier(member.node.key)) {
						return {
							key: member.node.key.name,
							value: resolveTSType(member.get('typeAnnotation', 'typeAnnotation'))
						}
					}
				})
				.filter((p: any) => p)
		}
	}
}
