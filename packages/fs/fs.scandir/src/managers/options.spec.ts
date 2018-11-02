import * as assert from 'assert';

import * as manager from './options';

import * as fsAdapter from '../adapters/fs';

import { Options, StrictOptions } from './options';

function getOptions(options?: Options): StrictOptions {
	return Object.assign<StrictOptions, Options | undefined>({
		fs: fsAdapter.getFileSystemAdapter(options ? options.fs : undefined),
		includeRootDirectory: false,
		stats: false,
		followSymlinks: true,
		throwErrorOnBrokenSymlinks: true,
		preFilter: null,
		filter: null,
		sort: null
	}, options);
}

describe('Managers → Options', () => {
	describe('.prepare', () => {
		it('should returns prepared options for empty object', () => {
			const expected = getOptions();

			const actual = manager.prepare();

			assert.deepStrictEqual(actual, expected);
		});

		it('should returns prepared options for provided object', () => {
			const expected = getOptions({ throwErrorOnBrokenSymlinks: false });

			const actual = manager.prepare({ throwErrorOnBrokenSymlinks: false });

			assert.deepStrictEqual(actual, expected);
		});
	});
});