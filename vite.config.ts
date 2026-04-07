import { defineConfig } from 'vite';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  // GitHub Pages project sites are served from /<repo-name>/.
  base: isGitHubActions && repoName ? `/${repoName}/` : '/',
});
