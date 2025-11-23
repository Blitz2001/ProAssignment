import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

dotenv.config();

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/globalehelp';

// Create backups directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function createBackup() {
  try {
    console.log('Starting database backup...');
    
    // Extract database name from URI
    const dbMatch = MONGO_URI.match(/\/([^\/\?]+)(\?|$)/);
    const dbName = dbMatch ? dbMatch[1] : 'globalehelp';
    
    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `backup-${timestamp}`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    // Use mongodump to create backup
    const mongodumpCommand = `mongodump --uri="${MONGO_URI}" --out="${backupPath}"`;
    
    console.log('Running mongodump...');
    await execAsync(mongodumpCommand);
    
    // Create compressed archive
    const archivePath = `${backupPath}.tar.gz`;
    const tarCommand = process.platform === 'win32' 
      ? `tar -czf "${archivePath}" -C "${BACKUP_DIR}" "${backupFilename}"`
      : `tar -czf "${archivePath}" -C "${BACKUP_DIR}" "${backupFilename}"`;
    
    console.log('Compressing backup...');
    await execAsync(tarCommand);
    
    // Remove uncompressed directory
    fs.rmSync(backupPath, { recursive: true, force: true });
    
    // Get file size
    const stats = fs.statSync(archivePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`✅ Backup created successfully: ${archivePath}`);
    console.log(`📦 Backup size: ${fileSizeMB} MB`);
    
    // Cleanup old backups (keep last 30 days)
    cleanupOldBackups();
    
    return archivePath;
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    throw error;
  }
}

function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    files.forEach(file => {
      if (file.startsWith('backup-') && file.endsWith('.tar.gz')) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < thirtyDaysAgo) {
          fs.unlinkSync(filePath);
          console.log(`🗑️  Deleted old backup: ${file}`);
        }
      }
    });
  } catch (error) {
    console.error('Error cleaning up old backups:', error);
  }
}

// Run backup if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createBackup()
    .then(() => {
      console.log('Backup process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Backup process failed:', error);
      process.exit(1);
    });
}

export default createBackup;

