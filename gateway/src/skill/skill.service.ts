import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadSetting } from '../setting/setting.service.js';
import { VSCODE_WORKSPACE } from '../hook/setting.js';

export interface SkillContent {
    name: string;
    description: string;
    body: string;
    skillDir: string;
    references: string[];
}

/**
 * Parse YAML frontmatter and body from SKILL.md content
 */
function parseSkillMd(content: string): { name: string; description: string; body: string } {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);

    if (!match) {
        return { name: '', description: '', body: content.trim() };
    }

    const frontMatter = match[1];
    const body = match[2].trim();

    let name = '';
    let description = '';

    const nameMatch = frontMatter.match(/name:\s*(.+)/);
    if (nameMatch) {
        name = nameMatch[1].trim();
    }

    const descMatch = frontMatter.match(/description:\s*(.+)/);
    if (descMatch) {
        description = descMatch[1].trim();
    }

    return { name, description, body };
}

/**
 * Extract relative file references from markdown body (e.g. [text](reference.md))
 */
function extractSkillReferences(body: string): string[] {
    const linkRegex = /\[([^\]]+)\]\((\.\/)?([^)\s]+)\)/g;
    const refs = new Set<string>();
    let match;
    while ((match = linkRegex.exec(body)) !== null) {
        const filePath = match[3].trim();
        if (!filePath.startsWith('..') && !filePath.includes('://')) {
            refs.add(filePath);
        }
    }
    return Array.from(refs);
}

/**
 * Resolve skill directory from user path (file or folder)
 */
function resolveSkillDir(entryPath: string): string | null {
    const trimmed = entryPath.replace(/^~/, os.homedir()).trim();
    const baseDir = path.isAbsolute(trimmed) ? '' : (VSCODE_WORKSPACE || process.cwd());
    const resolved = path.resolve(baseDir, trimmed);
    if (!fs.existsSync(resolved)) {
        return null;
    }
    const stat = fs.statSync(resolved);
    if (stat.isFile()) {
        return path.dirname(resolved);
    }
    return resolved;
}

export interface SkillMetadata {
    name: string;
    description: string;
    /** Directory name for loading when in multi-skill mode */
    dirName?: string;
}

/**
 * List available skills from SKILL_PATH setting.
 * If path points to a parent dir (e.g. .cursor/skills), returns all subdirs with SKILL.md.
 * If path points to a single skill dir, returns that one skill.
 */
export function listSkills(): SkillMetadata[] {
    const config = loadSetting();
    const skillPath = (config as any).SKILL_PATH as string | undefined;
    if (!skillPath || !skillPath.trim()) {
        return [];
    }

    const trimmed = skillPath.replace(/^~/, os.homedir()).trim();
    const baseDir = path.isAbsolute(trimmed) ? '' : (VSCODE_WORKSPACE || process.cwd());
    const resolved = path.resolve(baseDir, trimmed);
    if (!fs.existsSync(resolved)) {
        return [];
    }

    const stat = fs.statSync(resolved);
    const skills: SkillMetadata[] = [];

    if (stat.isFile()) {
        const skillDir = path.dirname(resolved);
        const skillMdPath = path.join(skillDir, 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
            const content = fs.readFileSync(skillMdPath, 'utf-8');
            const { name, description } = parseSkillMd(content);
            skills.push({ name: name || path.basename(skillDir), description });
        }
        return skills;
    }

    const skillMdInDir = path.join(resolved, 'SKILL.md');
    if (fs.existsSync(skillMdInDir)) {
        const content = fs.readFileSync(skillMdInDir, 'utf-8');
        const { name, description } = parseSkillMd(content);
        skills.push({ name: name || path.basename(resolved), description });
        return skills;
    }

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    for (const ent of entries) {
        if (ent.isDirectory()) {
            const subSkillMd = path.join(resolved, ent.name, 'SKILL.md');
            if (fs.existsSync(subSkillMd)) {
                const content = fs.readFileSync(subSkillMd, 'utf-8');
                const { name, description } = parseSkillMd(content);
                skills.push({ name: name || ent.name, description, dirName: ent.name });
            }
        }
    }
    return skills;
}

/**
 * Load skill content by name (when multiple skills exist) or the default skill
 */
function loadSkillFromDir(skillDir: string): SkillContent | null {
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
        return null;
    }
    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const { name, description, body } = parseSkillMd(content);
    const references = extractSkillReferences(body);
    return {
        name: name || path.basename(skillDir),
        description,
        body,
        skillDir,
        references
    };
}

function loadSkillByName(skillName?: string): SkillContent | null {
    const config = loadSetting();
    const skillPath = (config as any).SKILL_PATH as string | undefined;
    if (!skillPath || !skillPath.trim()) {
        return null;
    }

    const trimmed = skillPath.replace(/^~/, os.homedir()).trim();
    const baseDir = path.isAbsolute(trimmed) ? '' : (VSCODE_WORKSPACE || process.cwd());
    const resolved = path.resolve(baseDir, trimmed);
    if (!fs.existsSync(resolved)) {
        return null;
    }

    const stat = fs.statSync(resolved);
    let skillDir: string;

    if (stat.isFile()) {
        skillDir = path.dirname(resolved);
    } else {
        const skillMdInDir = path.join(resolved, 'SKILL.md');
        if (fs.existsSync(skillMdInDir)) {
            skillDir = resolved;
        } else if (skillName) {
            const subDir = path.join(resolved, skillName);
            if (fs.existsSync(path.join(subDir, 'SKILL.md'))) {
                skillDir = subDir;
            } else {
                return null;
            }
        } else {
            const skillList = listSkills();
            if (skillList.length > 0) {
                const first = skillList[0];
                return loadSkillByName(first.dirName || first.name);
            }
            return null;
        }
    }

    return loadSkillFromDir(skillDir);
}

/**
 * Load skill content from SKILL_PATH setting
 */
export function loadSkillContent(skillName?: string): SkillContent | null {
    return loadSkillByName(skillName);
}

/**
 * Read a referenced file within a skill directory (for progressive disclosure)
 */
export function readSkillFile(skillName: string, filePath: string): { content: string } | { error: string } {
    const skill = loadSkillContent();
    if (!skill) {
        return { error: 'Skill path not configured' };
    }

    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.startsWith('..')) {
        return { error: 'Path traversal not allowed' };
    }

    const resolvedPath = path.join(skill.skillDir, filePath);
    if (!resolvedPath.startsWith(path.resolve(skill.skillDir))) {
        return { error: 'Path traversal not allowed' };
    }

    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
        return { error: `File not found: ${filePath}` };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    return { content };
}
