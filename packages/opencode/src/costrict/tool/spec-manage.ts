/**
 * Spec Manage Tool - 内置插件版本
 * 管理 CoSpec 规范变更列表和任务进度
 */

import { Tool } from '@/tool/tool';
import { z } from 'zod';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { Log } from '@/util/log';

const log = Log.create({ service: 'spec-manage' });

/**
 * 参数Schema定义
 */
const parametersSchema = z.object({
  path: z.string().describe('当前工程路径'),
});

interface ChangeInfo {
  name: string;
  completedTasks: number;
  totalTasks: number;
}

const TASK_PATTERN = /^ {0,5}[-*]\s+\[[\sx]\]/i;
const COMPLETED_TASK_PATTERN = /^ {0,5}[-*]\s+\[x\]/i;

interface TaskProgress {
  total: number;
  completed: number;
}

/**
 * 从内容中统计任务进度
 */
function countTasksFromContent(content: string): TaskProgress {
  const lines = content.split('\n');
  let total = 0;
  let completed = 0;
  for (const line of lines) {
    if (line.match(TASK_PATTERN)) {
      total++;
      if (line.match(COMPLETED_TASK_PATTERN)) {
        completed++;
      }
    }
  }
  return { total, completed };
}

/**
 * 获取单个变更的任务进度
 */
async function getTaskProgressForChange(changesDir: string, changeName: string): Promise<TaskProgress> {
  const tasksPath = resolve(changesDir, changeName, 'task.md');
  try {
    const content = await Bun.file(tasksPath).text();
    return countTasksFromContent(content);
  } catch {
    return { total: 0, completed: 0 };
  }
}

/**
 * Spec Manage Tool
 */
export const SpecManageTool = Tool.define('spec-manage', async () => {
  return {
    description: `管理 CoSpec 规范变更列表。

功能：
- 列出所有活跃的变更 (changes)
- 查看每个变更的任务进度
- 显示已完成/总任务数

注意：需要在工程根目录下有 .cospec/plan/changes 目录`,

    parameters: parametersSchema,

    async execute(args: z.infer<typeof parametersSchema>, ctx) {
      const { path: projectPath } = args;

      log.info('Starting spec manage', { path: projectPath });

      const resolvedPath = resolve(process.cwd(), projectPath);
      const changesDir = resolve(resolvedPath, '.cospec', 'plan', 'changes');

      // 检查 changes 目录是否存在
      if (!existsSync(changesDir)) {
        log.error('Changes directory not found', { path: changesDir });
        return {
          title: 'CoSpec 变更目录不存在',
          metadata: {
            path: projectPath,
            error: 'directory_not_found',
            changes_count: 0,
          },
          output: `Error: No CoSpec changes directory found.  Path: ${changesDir}`,
        };
      }

      try {
        // 获取所有变更目录（排除 archive）
        const entries = await fs.readdir(changesDir, { withFileTypes: true });
        const changeDirs = entries
          .filter(entry => entry.isDirectory() && entry.name !== 'archive')
          .map(entry => entry.name);

        if (changeDirs.length === 0) {
          log.info('No active changes found', { path: projectPath });
          return {
            title: '无活跃变更',
            metadata: {
              path: projectPath,
              error: '',
              changes_count: 0,
            },
            output: 'No active changes found.',
          };
        }

        // 收集每个变更的任务进度
        const changes: ChangeInfo[] = [];
        
        for (const changeDir of changeDirs) {
          const progress = await getTaskProgressForChange(changesDir, changeDir);
          changes.push({
            name: changeDir,
            completedTasks: progress.completed,
            totalTasks: progress.total,
          });
        }

        // 按名称字母顺序排序
        changes.sort((a, b) => a.name.localeCompare(b.name));

        log.info('Spec manage completed', { 
          path: projectPath, 
          changesCount: changes.length 
        });

        // 格式化输出
        const outputLines = ['# CoSpec Active Changes\n'];
        outputLines.push(`Total: ${changes.length} change(s)\n`);
        
        for (const change of changes) {
          const progress = change.totalTasks > 0 
            ? `[${change.completedTasks}/${change.totalTasks}]` 
            : '[no tasks]';
          outputLines.push(`- ${change.name} ${progress}`);
        }

        return {
          title: `CoSpec Changes: ${changes.length} active`,
          metadata: {
            path: projectPath,
            error: '',
            changes_count: changes.length,
          },
          output: outputLines.join('\n'),
        };
      } catch (error) {
        log.error('Spec manage failed', {
          error: error instanceof Error ? error.message : String(error),
          path: projectPath,
        });
        return {
          title: '获取变更列表失败',
          metadata: {
            path: projectPath,
            error: error instanceof Error ? error.message : String(error),
            changes_count: 0,
          },
          output: `Error: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
});
