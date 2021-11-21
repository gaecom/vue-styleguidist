import * as bt from '@babel/types'
import { NodePath } from 'ast-types/lib/node-path'
import { visit } from 'recast'
import Documentation from '../Documentation'
import { ParseOptions } from '../parse'
import getDocblock from '../utils/getDocblock'
import getDoclets from '../utils/getDoclets'
import { setEventDescriptor } from './eventHandler'

/**
 * Extract information from an setup-style VueJs 3 component
 * about what events can be emitted
 * @param {NodePath} astPath
 * @param {Array<NodePath>} componentDefinitions
 * @param {string} originalFilePath
 */
export default async function setupEventHandler(
	documentation: Documentation,
	componentDefinition: NodePath,
	astPath: bt.File,
	opt: ParseOptions
) {
	visit(astPath.program, {
		visitCallExpression(nodePath) {
			if (bt.isIdentifier(nodePath.node.callee) && nodePath.node.callee.name === 'defineEmits') {
				if (bt.isArrayExpression(nodePath.get('arguments', 0).node)) {
					nodePath.get('arguments', 0, 'elements').each((element: NodePath) => {
						if (bt.isStringLiteral(element.node)) {
							const eventDescriptor = documentation.getEventDescriptor(element.node.value)
							const docBlock = getDocblock(element)
							if (docBlock) {
								const jsDoc = getDoclets(docBlock)
								setEventDescriptor(eventDescriptor, jsDoc)
							}
						}
					})
				}
			}
			return false
		}
	})
}
