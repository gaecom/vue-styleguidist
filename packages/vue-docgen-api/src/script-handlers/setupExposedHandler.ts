import * as bt from '@babel/types'
import { NodePath } from 'ast-types/lib/node-path'
import Documentation from '../Documentation'
import { ParseOptions } from '../parse'

/**
 * Extract information from an setup-style VueJs 3 component
 * about what methods and variable are exposed
 * @param {NodePath} astPath
 * @param {Array<NodePath>} componentDefinitions
 * @param {string} originalFilePath
 */
export default async function setupExposedHandler(
	documentation: Documentation,
	componentDefinition: NodePath,
	astPath: bt.File,
	opt: ParseOptions
) {}
