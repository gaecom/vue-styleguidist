import { ParserPlugin } from '@babel/parser'
import * as bt from '@babel/types'
import { NodePath } from 'ast-types/lib/node-path'
import babylon from '../../babel-parser'
import Documentation, { ExposedDescriptor } from '../../Documentation'
import resolveExportedComponent from '../../utils/resolveExportedComponent'
import setupExposedHandler from '../setupExposedHandler'

jest.mock('../../Documentation')

function parse(src: string, plugins?: ParserPlugin[]): NodePath | undefined {
	const ast = babylon({ plugins }).parse(src)
	return resolveExportedComponent(ast)[0].get('default')
}

describe('setupExposedHandler', () => {
	let documentation: Documentation
	let mockExposedDescriptor: ExposedDescriptor

	let defaultAST: bt.File
	const options = { filePath: '', validExtends: () => true }
	beforeAll(() => {
		defaultAST = babylon({ plugins: ['typescript'] }).parse('const a  = 1')
	})

	beforeEach(() => {
		mockExposedDescriptor = {
			description: '',
			name: ''
		}
		const MockDocumentation = require('../../Documentation').default
		documentation = new MockDocumentation('test/path')
		const mockGetExposedDescriptor = documentation.getExposedDescriptor as jest.Mock
		mockGetExposedDescriptor.mockReturnValue(mockExposedDescriptor)
	})

	async function parserTest(
		src: string,
		plugins: ParserPlugin[] = ['typescript'],
		ast = defaultAST
	): Promise<ExposedDescriptor> {
		const def = parse(src, plugins)
		if (def) {
			await setupExposedHandler(documentation, def, ast, options)
		}
		return mockExposedDescriptor
	}

	it('should resolve Exposeds in defineProps', async () => {
		const src = `
        defineExposed(['testProps'])
        `
		const prop = await parserTest(src)
		expect(prop).toMatchInlineSnapshot(`
		Object {
		  "description": "",
		  "name": "",
		}
	`)
	})
})
