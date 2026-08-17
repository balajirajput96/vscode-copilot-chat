/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { createLibTestingContext } from '../../test/context';
import { makeFsUri } from '../../util/uri';
import { extractRepoInfo } from '../repository';
import { IInstantiationService } from '../../../../../../../util/vs/platform/instantiation/common/instantiation';

const execFileAsync = promisify(execFile);

async function getExpectedGitHubRepo(): Promise<{ org: string; repo: string }> {
	const repository = process.env.GITHUB_REPOSITORY;
	if (repository) {
		const [org, repo] = repository.split('/');
		if (org && repo) {
			return { org, repo };
		}
	}

	try {
		const repoRoot = path.resolve(__dirname, '../../../../../../../../');
		const { stdout } = await execFileAsync('git', ['config', '--get', 'remote.origin.url'], {
			cwd: repoRoot,
		});
		const match = stdout.trim().match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
		if (match) {
			return { org: match[1], repo: match[2] };
		}
	} catch {
		// Use the upstream repository as the fallback for source checkouts without a remote.
	}

	return { org: 'microsoft', repo: 'vscode-copilot-chat' };
}

suite('Extract repo info tests', function () {
	const repoRoot = path.resolve(__dirname, '../../../../../../../../');
	const baseFolder = { uri: makeFsUri(repoRoot) };

	test('Extract repo info', async function () {
		const accessor = createLibTestingContext().createTestingAccessor();
		const expectedRepo = await getExpectedGitHubRepo();
		const info = await extractRepoInfo(accessor, baseFolder.uri);

		assert.ok(info);

		// url and pathname get their own special treatment because they depend on how the repo was cloned.
		const { url, pathname, repoId, ...repoInfo } = info;

		assert.deepStrictEqual(repoInfo, {
			baseFolder,
			hostname: 'github.com'
		});
		assert.ok(repoId);
		assert.deepStrictEqual(
			{ org: repoId.org, repo: repoId.repo, type: repoId.type },
			{ ...expectedRepo, type: 'github' }
		);
		assert.ok(
			[
				`git@github.com:${expectedRepo.org}/${expectedRepo.repo}`,
				`https://github.com/${expectedRepo.org}/${expectedRepo.repo}`,
				`https://github.com/${expectedRepo.org}/${expectedRepo.repo}.git`,
			].includes(url),
			`url is ${url}`
		);
		assert.ok(
			pathname.startsWith(`/github/${expectedRepo.repo}`) ||
			pathname.startsWith(`/${expectedRepo.org}/${expectedRepo.repo}`),
			`pathname is ${pathname}`
		);

		assert.deepStrictEqual(await extractRepoInfo(accessor, 'file:///tmp/does/not/exist/.git/config'), undefined);
	});

	test('Extract repo info - Jupyter Notebook vscode-notebook-cell ', async function () {
		const cellUri = baseFolder.uri.replace(/^file:/, 'vscode-notebook-cell:');
		assert.ok(cellUri.startsWith('vscode-notebook-cell:'));
		const accessor = createLibTestingContext().createTestingAccessor();
		const instantiationService = accessor.get(IInstantiationService);
		const expectedRepo = await getExpectedGitHubRepo();
		const info = await extractRepoInfo(accessor, cellUri);

		assert.ok(info);

		// url and pathname get their own special treatment because they depend on how the repo was cloned.
		const { url, pathname, repoId, ...repoInfo } = info;

		assert.deepStrictEqual(repoInfo, {
			baseFolder,
			hostname: 'github.com'
		});
		assert.ok(repoId);
		assert.deepStrictEqual(
			{ org: repoId.org, repo: repoId.repo, type: repoId.type },
			{ ...expectedRepo, type: 'github' }
		);
		assert.ok(
			[
				`git@github.com:${expectedRepo.org}/${expectedRepo.repo}`,
				`https://github.com/${expectedRepo.org}/${expectedRepo.repo}`,
				`https://github.com/${expectedRepo.org}/${expectedRepo.repo}.git`,
			].includes(url),
			`url is ${url}`
		);
		assert.ok(
			pathname.startsWith(`/github/${expectedRepo.repo}`) ||
			pathname.startsWith(`/${expectedRepo.org}/${expectedRepo.repo}`),
			`pathname is ${pathname}`
		);

		assert.deepStrictEqual(await instantiationService.invokeFunction(extractRepoInfo, 'file:///tmp/does/not/exist/.git/config'), undefined);
	});
});
