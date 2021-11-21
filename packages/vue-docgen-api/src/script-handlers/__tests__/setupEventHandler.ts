import { ParserPlugin } from '@babel/parser'
import * as bt from '@babel/types'
import { NodePath } from 'ast-types/lib/node-path'
import babylon from '../../babel-parser'
import Documentation, { EventDescriptor } from '../../Documentation'
import resolveExportedComponent from '../../utils/resolveExportedComponent'
import setupEventHandler from '../setupEventHandler'

function parse(src: string, plugins?: ParserPlugin[]): NodePath | undefined {
	const ast = babylon({ plugins }).parse(src)
	return resolveExportedComponent(ast)[0].get('default')
}

describe('setupEventHandler', () => {
	let documentation: Documentation
	let mockEventDescriptor: EventDescriptor

	let defaultAST: bt.File
	const options = { filePath: '', validExtends: () => true }
	beforeAll(() => {
		defaultAST = babylon({ plugins: ['typescript'] }).parse('const a  = 1')
	})

	beforeEach(() => {
		mockEventDescriptor = {
			description: '',
			name: ''
		}
		const MockDocumentation = require('../../Documentation').default
		documentation = new MockDocumentation('test/path')
		const mockGetEventDescriptor = documentation.getEventDescriptor as jest.Mock
		mockGetEventDescriptor.mockReturnValue(mockEventDescriptor)
	})

	async function parserTest(
		src: string,
		plugins?: ParserPlugin[],
		ast = defaultAST
	): Promise<EventDescriptor> {
		const def = parse(src, plugins)
		if (def) {
			await setupEventHandler(documentation, def, ast, options)
		}
		return mockEventDescriptor
	}

	it('should resolve emit from defineEmits function', async () => {
		const src = `
        const emit = defineEmits(['test'])
        `
		const prop = await parserTest(src)
		expect(prop).toMatchInlineSnapshot()
	})

	it('should resolve event comments in defineEmits', async () => {
		const src = `
        const emit = defineEmits([
			/**
			 * A test has been triggered
			 */
			'test'
		])
        `
		const prop = await parserTest(src)
		expect(prop).toMatchInlineSnapshot()
	})
})
