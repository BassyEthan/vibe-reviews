/**
 * Generate Embeddings Processor
 *
 * Background job processor that triggers the Python embedder script.
 * The Python script reads from PostgreSQL, generates embeddings, and saves to JSON.
 * Then the upsert_pinecone.py script uploads to Pinecone.
 */

import { JobProcessor, Job } from '../interfaces/job-queue.interface.js';
import { logger } from '../../utils/logger.js';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class GenerateEmbeddingsProcessor implements JobProcessor {
  private pythonPath: string;
  private pipelineDir: string;

  constructor(pythonPath: string = 'python3', pipelineDir?: string) {
    this.pythonPath = pythonPath;
    // Default to data-pipeline directory relative to mcp-server
    this.pipelineDir =
      pipelineDir ||
      join(__dirname, '../../../..', 'data-pipeline');
    logger.info('GenerateEmbeddingsProcessor initialized', {
      pythonPath: this.pythonPath,
      pipelineDir: this.pipelineDir,
    });
  }

  async process(job: Job): Promise<void> {
    logger.info('Generating embeddings', {
      jobId: job.id,
    });

    try {
      // Step 1: Run embedder.py (reads from PostgreSQL, generates embeddings, saves to JSON)
      logger.info('Running embedder.py...');
      await this.runPythonScript('embedder.py');

      // Step 2: Run upsert_pinecone.py (reads JSON embeddings, uploads to Pinecone)
      logger.info('Running upsert_pinecone.py...');
      await this.runPythonScript('upsert_pinecone.py');

      logger.info('Embeddings generated and uploaded successfully', {
        jobId: job.id,
      });
    } catch (error) {
      logger.error('Failed to generate embeddings', {
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async runPythonScript(scriptName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const scriptPath = join(this.pipelineDir, scriptName);

      logger.info('Executing Python script', {
        script: scriptName,
        path: scriptPath,
      });

      const pythonProcess = spawn(this.pythonPath, [scriptPath], {
        cwd: this.pipelineDir,
        env: process.env,
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Log Python output in real-time
        logger.debug('Python stdout', { script: scriptName, output });
      });

      pythonProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        // Log Python errors in real-time
        logger.warn('Python stderr', { script: scriptName, output });
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          logger.info('Python script completed successfully', {
            script: scriptName,
            exitCode: code,
          });
          resolve();
        } else {
          logger.error('Python script failed', {
            script: scriptName,
            exitCode: code,
            stdout: stdout.substring(0, 500), // Limit log size
            stderr: stderr.substring(0, 500),
          });
          reject(
            new Error(
              `Python script ${scriptName} exited with code ${code}: ${stderr}`
            )
          );
        }
      });

      pythonProcess.on('error', (error) => {
        logger.error('Failed to spawn Python process', {
          script: scriptName,
          error: error.message,
        });
        reject(error);
      });
    });
  }

  /**
   * Check if Python and required packages are available.
   */
  async checkDependencies(): Promise<boolean> {
    try {
      // Check Python version
      const { stdout } = await execAsync(`${this.pythonPath} --version`);
      logger.info('Python version', { version: stdout.trim() });

      // Check if data-pipeline directory exists
      if (!existsSync(this.pipelineDir)) {
        logger.error('Data pipeline directory not found', {
          path: this.pipelineDir,
        });
        return false;
      }

      // Check if embedder.py exists
      const embedderPath = join(this.pipelineDir, 'embedder.py');
      if (!existsSync(embedderPath)) {
        logger.error('embedder.py not found', { path: embedderPath });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Dependency check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}
