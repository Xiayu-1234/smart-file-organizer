#!/usr/bin/env node

/**
 * Smart File Organizer — 智能文件整理工具
 *
 * 功能：
 *   - 自动扫描目录，按文件类型分类
 *   - 支持预览模式（--dry-run），安全无痛
 *   - 支持自定义分类规则（--config）
 *   - 批量整理，统计报告
 *
 * 用法：
 *   node index.js <目标目录> [选项]
 *   node index.js ./Downloads --dry-run
 *   node index.js ./Desktop --config ./rules.json
 */

const fs = require('fs');
const path = require('path');

// ─── 默认分类规则 ───────────────────────────────────────────────
const DEFAULT_RULES = {
  '文档': ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.csv', '.json'],
  '图片': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico', '.psd'],
  '视频': ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'],
  '音频': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
  '压缩包': ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'],
  '程序': ['.exe', '.msi', '.bat', '.sh', '.ps1', '.apk', '.dmg'],
  '代码': ['.js', '.ts', '.py', '.java', '.c', '.cpp', '.go', '.rs', '.html', '.css', '.vue', '.jsx', '.tsx'],
  '种子': ['.torrent'],
  '字体': ['.ttf', '.otf', '.woff', '.woff2'],
};

// ─── 工具函数 ────────────────────────────────────────────────────

/** 安全读取目录 */
function safeReadDir(dirPath) {
  try {
    return fs.readdirSync(dirPath).filter(name => {
      // 跳过隐藏文件和目录
      return !name.startsWith('.') && name !== 'desktop.ini';
    });
  } catch (err) {
    console.error(`❌ 无法读取目录: ${dirPath}`);
    console.error(`   ${err.message}`);
    process.exit(1);
  }
}

/** 获取文件大小的人类可读格式 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** 根据扩展名匹配分类 */
function categorize(ext, rules) {
  const lower = ext.toLowerCase();
  for (const [category, extensions] of Object.entries(rules)) {
    if (extensions.includes(lower)) return category;
  }
  return '其他';
}

/** 生成安全的文件名（避免重名） */
function safeFileName(dir, name) {
  let full = path.join(dir, name);
  if (!fs.existsSync(full)) return name;

  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let counter = 1;
  while (fs.existsSync(full)) {
    full = path.join(dir, `${base} (${counter})${ext}`);
    counter++;
  }
  return path.basename(full);
}

// ─── 核心逻辑 ────────────────────────────────────────────────────

/**
 * 分析目录并返回分类结果
 */
function analyze(dirPath, rules) {
  const entries = safeReadDir(dirPath);
  const files = [];
  const dirs = [];
  const result = {};

  for (const name of entries) {
    const fullPath = path.join(dirPath, name);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      dirs.push({ name, path: fullPath });
      continue;
    }

    const ext = path.extname(name);
    const category = categorize(ext, rules);
    const size = stat.size;

    if (!result[category]) result[category] = [];
    result[category].push({ name, ext, size, path: fullPath });
    files.push({ name, ext, size, path: fullPath, category });
  }

  return { files, dirs, categorized: result };
}

/**
 * 执行整理操作
 */
function organize(dirPath, rules, dryRun = false) {
  const { files, dirs, categorized } = analyze(dirPath, rules);

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  // ── 打印分析报告 ──
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║     📂 Smart File Organizer           ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`  目录: ${dirPath}`);
  console.log(`  文件: ${files.length} 个 | 文件夹: ${dirs.length} 个`);
  console.log(`  总大小: ${formatSize(totalSize)}`);
  console.log('');

  if (files.length === 0) {
    console.log('  ✨ 目录为空，无需整理。');
    return;
  }

  // 打印分类统计
  const categories = Object.keys(categorized).sort((a, b) => categorized[b].length - categorized[a].length);
  console.log('  ┌──────────────────────────────────────┐');
  for (const cat of categories) {
    const items = categorized[cat];
    const catSize = items.reduce((s, f) => s + f.size, 0);
    const bar = '█'.repeat(Math.min(items.length, 30));
    console.log(`  │ ${cat.padEnd(8)} ${String(items.length).padStart(3)} 个  ${formatSize(catSize).padStart(8)}  ${bar}`);
  }
  console.log('  └──────────────────────────────────────┘');
  console.log('');

  // 打印每个分类下的文件列表
  for (const cat of categories) {
    const items = categorized[cat];
    console.log(`  📁 ${cat} (${items.length} 个)`);
    for (const f of items.slice(0, 8)) {
      console.log(`      ${f.name.padEnd(40)} ${formatSize(f.size)}`);
    }
    if (items.length > 8) {
      console.log(`      ... 还有 ${items.length - 8} 个文件`);
    }
    console.log('');
  }

  // ── 执行整理 ──
  if (dryRun) {
    console.log('  ⚠️  【预览模式】以上为预览结果，文件未实际移动。');
    console.log('  去掉 --dry-run 参数以执行实际整理。');
    console.log('');
    return;
  }

  console.log('  ▶ 开始整理...');
  console.log('');

  let movedCount = 0;
  let skippedCount = 0;
  const summary = [];

  for (const cat of categories) {
    const catDir = path.join(dirPath, cat);
    const items = categorized[cat];

    if (cat === '其他') {
      skippedCount += items.length;
      summary.push({ category: cat, moved: 0, skipped: items.length });
      continue; // 跳过分到"其他"的文件
    }

    // 创建分类目录
    if (!fs.existsSync(catDir)) {
      fs.mkdirSync(catDir, { recursive: true });
    }

    let moved = 0;
    for (const f of items) {
      try {
        const safeName = safeFileName(catDir, f.name);
        const dest = path.join(catDir, safeName);
        fs.renameSync(f.path, dest);
        moved++;
        movedCount++;
      } catch (err) {
        console.log(`     ⚠️ 跳过: ${f.name} (${err.message})`);
        skippedCount++;
      }
    }
    summary.push({ category: cat, moved, skipped: items.length - moved });
  }

  // ── 打印结果 ──
  console.log('  ════════════════════════════════════');
  console.log('         📊 整 理 结 果');
  console.log('  ════════════════════════════════════');
  console.log('');
  for (const s of summary) {
    const status = s.moved > 0 ? `✅ 已移动 ${s.moved} 个` : `⏭️  跳过 ${s.skipped} 个`;
    console.log(`     ${s.category.padEnd(8)} ${status}`);
  }
  console.log('');
  console.log(`  ✅ 完成！共移动 ${movedCount} 个文件，跳过 ${skippedCount} 个。`);
  console.log('');
}

// ─── CLI 入口 ────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    target: null,
    dryRun: false,
    configPath: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
      case '-d':
        options.dryRun = true;
        break;
      case '--config':
      case '-c':
        options.configPath = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (!options.target && !args[i].startsWith('-')) {
          options.target = args[i];
        }
    }
  }

  return options;
}

function showHelp() {
  console.log(`
  Smart File Organizer - 智能文件整理工具

  用法:
    node index.js <目标目录> [选项]

  选项:
    --dry-run, -d     预览模式（只查看，不移动文件）
    --config, -c      指定自定义分类规则 JSON 文件
    --help, -h        显示帮助信息

  示例:
    node index.js ~/Downloads --dry-run
    node index.js ~/Desktop
    node index.js ~/Documents -c ./my-rules.json
  `);
}

// ─── 主程序 ──────────────────────────────────────────────────────

function main() {
  const opts = parseArgs();

  if (opts.help) {
    showHelp();
    process.exit(0);
  }

  if (!opts.target) {
    console.log('❌ 请指定目标目录。');
    console.log('   用法: node index.js <目录路径>');
    console.log('   帮助: node index.js --help');
    process.exit(1);
  }

  const targetDir = path.resolve(opts.target);

  if (!fs.existsSync(targetDir)) {
    console.error(`❌ 目录不存在: ${targetDir}`);
    process.exit(1);
  }

  if (!fs.statSync(targetDir).isDirectory()) {
    console.error(`❌ 目标不是目录: ${targetDir}`);
    process.exit(1);
  }

  // 加载自定义规则（如有）
  let rules = DEFAULT_RULES;
  if (opts.configPath) {
    const configPath = path.resolve(opts.configPath);
    if (fs.existsSync(configPath)) {
      try {
        rules = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        console.log(`  ✓ 已加载自定义规则: ${configPath}`);
      } catch (err) {
        console.error(`❌ 规则文件格式错误: ${err.message}`);
        process.exit(1);
      }
    } else {
      console.error(`❌ 规则文件不存在: ${configPath}`);
      process.exit(1);
    }
  }

  organize(targetDir, rules, opts.dryRun);
}

main();
