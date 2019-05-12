import * as assert from 'assert';

import * as fsScandir from '@nodelib/fs.scandir';
import * as sinon from 'sinon';

import Settings from '../settings';
import * as tests from '../tests/index';
import { Entry } from '../types/index';
import AsyncReader from './async';

type ScandirSignature = typeof fsScandir.scandir;

class TestReader extends AsyncReader {
	protected readonly _scandir: ScandirSignature = sinon.stub() as unknown as ScandirSignature;

	constructor(_settings: Settings = new Settings()) {
		super(_settings);
	}

	public get scandir(): sinon.SinonStub {
		return this._scandir as unknown as sinon.SinonStub;
	}
}

describe('Readers → Async', () => {
	describe('.read', () => {
		it('should emit "error" event when the first call of scandir is broken', (done) => {
			const reader = new TestReader();

			reader.scandir.yields(tests.EPERM_ERRNO);

			reader.onError((error) => {
				assert.ok(error);
				done();
			});

			reader.read('non-exist-directory');
		});

		it('should emit "end" event when the first call of scandir is broken but this error can be suppressed', (done) => {
			const settings = new Settings({
				errorFilter: (error) => error.code === 'EPERM'
			});
			const reader = new TestReader(settings);

			reader.scandir.yields(tests.EPERM_ERRNO);

			reader.onEnd(() => {
				done();
			});

			reader.read('non-exist-directory');
		});

		it('should do not emit "entry" event after first broken scandir call', (done) => {
			const reader = new TestReader();

			const firstFakeDirectoryEntry = tests.buildFakeDirectoryEntry({ name: 'a', path: 'directory/a' });
			const secondFakeDirectoryEntry = tests.buildFakeDirectoryEntry({ name: 'b', path: 'directory/b' });

			reader.scandir.onFirstCall().yields(null, [firstFakeDirectoryEntry, secondFakeDirectoryEntry]);
			reader.scandir.onSecondCall().yields(tests.EPERM_ERRNO);
			reader.scandir.onThirdCall().yields(tests.EPERM_ERRNO);

			/**
			 * If the behavior is broken, then a third scandir call will trigger an unhandled error.
			 */
			reader.onError((error) => {
				assert.ok(error);
				done();
			});

			reader.read('directory');
		});

		it('should return entries', (done) => {
			const reader = new TestReader();

			const fakeDirectoryEntry = tests.buildFakeDirectoryEntry();
			const fakeFileEntry = tests.buildFakeFileEntry();

			reader.scandir.onFirstCall().yields(null, [fakeDirectoryEntry]);
			reader.scandir.onSecondCall().yields(null, [fakeFileEntry]);

			const entries: Entry[] = [];

			reader.onEntry((entry) => entries.push(entry));

			reader.onEnd(() => {
				assert.deepStrictEqual(entries, [fakeDirectoryEntry, fakeFileEntry]);
				done();
			});

			reader.read('directory');
		});

		it('should push to results only directories', (done) => {
			const settings = new Settings({ entryFilter: (entry) => !entry.dirent.isFile() });
			const reader = new TestReader(settings);

			const fakeDirectoryEntry = tests.buildFakeDirectoryEntry();
			const fakeFileEntry = tests.buildFakeFileEntry();

			reader.scandir.onFirstCall().yields(null, [fakeDirectoryEntry]);
			reader.scandir.onSecondCall().yields(null, [fakeFileEntry]);

			const entries: Entry[] = [];

			reader.onEntry((entry) => entries.push(entry));

			reader.onEnd(() => {
				assert.deepStrictEqual(entries, [fakeDirectoryEntry]);
				done();
			});

			reader.read('directory');
		});

		it('should do not read root directory', (done) => {
			const settings = new Settings({ deepFilter: () => false });
			const reader = new TestReader(settings);

			const fakeDirectoryEntry = tests.buildFakeDirectoryEntry();
			const fakeFileEntry = tests.buildFakeFileEntry();

			reader.scandir.onFirstCall().yields(null, [fakeDirectoryEntry]);
			reader.scandir.onSecondCall().yields(null, [fakeFileEntry]);

			const entries: Entry[] = [];

			reader.onEntry((entry) => entries.push(entry));

			reader.onEnd(() => {
				assert.deepStrictEqual(entries, [fakeDirectoryEntry]);
				done();
			});

			reader.read('directory');
		});
	});

	describe('.destroy', () => {
		it('should do not emit entries after destroy', (done) => {
			const reader = new TestReader();

			const firstFakeDirectoryEntry = tests.buildFakeDirectoryEntry({ name: 'a', path: 'directory/a' });
			const fakeFileEntry = tests.buildFakeFileEntry();

			reader.scandir.onFirstCall().yields(null, [firstFakeDirectoryEntry]);
			reader.scandir.onSecondCall().yields(null, [fakeFileEntry]);

			reader.onEntry((entry) => {
				if (entry.name === 'a') {
					reader.destroy();
				} else {
					assert.fail('should do not emit entries after destroy');
				}
			});

			reader.onEnd(() => {
				done();
			});

			reader.read('directory');
		});

		it('should throw an error when trying to destroy reader twice', () => {
			const reader = new TestReader();

			const expectedErrorMessageRe = /The reader is already destroyed/;

			reader.destroy();

			assert.throws(() => reader.destroy(), expectedErrorMessageRe);
		});
	});
});