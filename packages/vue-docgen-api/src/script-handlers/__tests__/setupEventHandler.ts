import { ParserPlugin } from '@babel/parser'
import * as bt from '@babel/types'
import { NodePath } from 'ast-types/lib/node-path'
import babylon from '../../babel-parser'
import resolveExportedComponent from '../../utils/resolveExportedComponent'
import Documentation, { EventDescriptor } from '../../Documentation'
import setupEventHandler from '../setupEventHandler'

jest.mock('../../Documentation')

function parse(src: string, plugins?: ParserPlugin[]): bt.File {
	return babylon({ plugins }).parse(src)
}

describe('setupEventHandler', () => {
	let documentation: Documentation
	let mockEventDescriptor: EventDescriptor

	let stubNodePath: NodePath<any, any> | undefined
	const options = { filePath: '', validExtends: () => true }
	beforeAll(() => {
		const defaultAST = babylon({ plugins: ['typescript'] }).parse('export default {}')
		stubNodePath = resolveExportedComponent(defaultAST)[0]?.get('default')
	})

	beforeEach(() => {
		mockEventDescriptor = {
			description: '',
			name: 'mockEvent'
		}
		const MockDocumentation = require('../../Documentation').default
		documentation = new MockDocumentation('test/path')
		const mockGetPropDescriptor = documentation.getEventDescriptor as jest.Mock
		mockGetPropDescriptor.mockReturnValue(mockEventDescriptor)
	})

	async function parserTest(
		src: string,
		plugins: ParserPlugin[] = ['typescript']
	): Promise<EventDescriptor> {
		const ast = parse(src, plugins)
		if (ast) {
			await setupEventHandler(documentation, stubNodePath as NodePath<any, any>, ast, options)
		}
		return mockEventDescriptor
	}

	describe('JavaScript', () => {
		it('should resolve emit from defineEmits function', async () => {
			const src = `
          const emit = defineEmits([
            /**
             * this is a test event
             */ 
            'test'
          ])
          `
			const event = await parserTest(src)
			expect(documentation.getEventDescriptor).toHaveBeenCalledWith('test')
			expect(event).toMatchObject({
				description: 'this is a test event',
				name: 'mockEvent'
			})
		})
	})

	describe('TypeScript', () => {
		it('should resolve emit from defineEmits function types', async () => {
			const src = `
          const emit = defineEmits{
            /**
             * Cancels everything
             */
            (event: 'cancel'): boolean
          }>()
          `
			const event = await parserTest(src)
			expect(documentation.getEventDescriptor).toHaveBeenCalledWith('cancel')
			expect(event).toMatchObject({
				description: 'Cancels everything',
				name: 'mockEvent'
			})
		})
	})
})
