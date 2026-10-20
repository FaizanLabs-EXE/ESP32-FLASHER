const API = 'https://api.github.com';
const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };

export function parseGitHubUrl(value) {
  const url = new URL(value.trim());
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') throw new Error('Use a github.com URL.');
  const p = url.pathname.split('/').filter(Boolean);
  if (p.length < 2) throw new Error('Repository URL must contain owner and repository.');
  const [owner, repoRaw] = p;
  const repo = repoRaw.replace(/\.git$/, '');
  let tag = null, asset = null;
  if (p[2] === 'releases' && p[3] === 'tag') tag = decodeURIComponent(p[4] || '');
  if (p[2] === 'releases' && p[3] === 'download') { tag = decodeURIComponent(p[4] || ''); asset = decodeURIComponent(p.slice(5).join('/')); }
  return { owner, repo, tag, asset };
}

async function api(path) {
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) throw new Error(res.status === 403 ? 'GitHub API rate limit reached. Try later or use local files.' : `GitHub API error ${res.status}.`);
  return res.json();
}

function isBin(name) { return /\.bin$/i.test(name); }
function addressFor(name) {
  const n = name.toLowerCase();
  const embedded = n.match(/(?:^|[-_.])(?:0x)?([0-9a-f]{4,8})(?:[-_.]|\.bin$)/i);
  if (embedded) return `0x${embedded[1].toLowerCase()}`;
  if (n.includes('bootloader')) return '0x1000';
  if (n.includes('partition')) return '0x8000';
  if (n.includes('boot_app0') || n.includes('ota_data_initial')) return '0xe000';
  return '0x10000';
}
async function asFirmware(item) {
  const res = await fetch(item.url);
  if (!res.ok) throw new Error(`Could not download ${item.name}.`);
  const buffer = await res.arrayBuffer();
  return { name:item.name, size:buffer.byteLength, data:new Uint8Array(buffer), address:addressFor(item.name), source:item.url };
}

export async function resolveFirmware(value, status = () => {}) {
  const id = parseGitHubUrl(value);
  status('Reading repository metadata...');
  const repoInfo = await api(`/repos/${id.owner}/${id.repo}`);
  let assets = [];
  try {
    status('Checking GitHub releases...');
    const release = id.tag ? await api(`/repos/${id.owner}/${id.repo}/releases/tags/${encodeURIComponent(id.tag)}`) : await api(`/repos/${id.owner}/${id.repo}/releases/latest`);
    assets = (release.assets || []).filter(a => isBin(a.name) && (!id.asset || a.name === id.asset)).map(a => ({name:a.name,url:a.browser_download_url,size:a.size}));
  } catch (e) { status('No matching published release. Scanning the default branch...'); }
  if (!assets.length) {
    const branch = repoInfo.default_branch;
    const tree = await api(`/repos/${id.owner}/${id.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    assets = (tree.tree || []).filter(x => x.type === 'blob' && isBin(x.path) && x.size <= 32*1024*1024).slice(0,12).map(x => ({name:x.path.split('/').pop(),url:`https://raw.githubusercontent.com/${id.owner}/${id.repo}/${branch}/${x.path.split('/').map(encodeURIComponent).join('/')}`,size:x.size}));
  }
  if (!assets.length) throw new Error('No .bin firmware was found in releases or the default branch. Upload local binaries instead.');
  status(`Downloading ${assets.length} firmware image${assets.length>1?'s':''}...`);
  const files = await Promise.all(assets.map(asFirmware));
  return { repo:repoInfo.full_name, description:repoInfo.description || 'No repository description', stars:repoInfo.stargazers_count, files };
}
