import { randomUUID } from 'crypto';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

const PLANS_DIR = join(homedir(), '.openmcp', 'plans');
const MAX_SLUG_RETRIES = 10;

const WORD_LIST = [
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
    'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho',
    'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
    'nova', 'stellar', 'cosmic', 'lunar', 'solar', 'aurora', 'nebula',
    'quasar', 'pulsar', 'comet', 'meteor', 'galaxy', 'orbit', 'zenith',
    'apex', 'summit', 'crest', 'peak', 'pinnacle', 'vertex', 'crown',
    'thrive', 'bloom', 'flourish', 'prosper', 'radiant', 'luminous',
    'crystal', 'prism', 'shard', 'facet', 'amber', 'coral', 'jade',
    'azure', 'crimson', 'verdant', 'golden', 'silver', 'obsidian'
];

function generateWordSlug(): string {
    const w1 = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    const w2 = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    const w3 = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    return `${w1}-${w2}-${w3}`;
}

const planSlugCache = new Map<string, string>();

async function ensurePlansDirectory(): Promise<void> {
    if (!existsSync(PLANS_DIR)) {
        await mkdir(PLANS_DIR, { recursive: true });
    }
}

export async function getPlanSlug(sessionId: string): Promise<string> {
    let slug = planSlugCache.get(sessionId);
    if (!slug) {
        await ensurePlansDirectory();
        for (let i = 0; i < MAX_SLUG_RETRIES; i++) {
            slug = generateWordSlug();
            const filePath = join(PLANS_DIR, `${slug}.md`);
            if (!existsSync(filePath)) {
                break;
            }
        }
        planSlugCache.set(sessionId, slug!);
    }
    return slug!;
}

export function setPlanSlug(sessionId: string, slug: string): void {
    planSlugCache.set(sessionId, slug);
}

export function clearPlanSlug(sessionId: string): void {
    planSlugCache.delete(sessionId);
}

export async function getPlanFilePath(sessionId: string): Promise<string> {
    const slug = await getPlanSlug(sessionId);
    return join(PLANS_DIR, `${slug}.md`);
}

export async function readPlan(sessionId: string): Promise<string | null> {
    const filePath = await getPlanFilePath(sessionId);
    try {
        const content = await readFile(filePath, 'utf-8');
        return content;
    } catch {
        return null;
    }
}

export async function writePlan(sessionId: string, content: string): Promise<void> {
    const filePath = await getPlanFilePath(sessionId);
    await ensurePlansDirectory();
    await writeFile(filePath, content, 'utf-8');
}
