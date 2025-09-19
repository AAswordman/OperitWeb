import puppeteer from 'puppeteer';
import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_PATH = path.resolve(__dirname, 'public/content/docs');
const PDF_OUTPUT_PATH = path.resolve(__dirname, 'converted_docs/pdf');
const BASE_URL = 'http://localhost:5173/#/guide';

async function findMarkdownFiles(dir) {
  let files = [];
  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(await findMarkdownFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function generatePdf(browser, url, outputPath) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.markdown-body', { visible: true });
    
    // 强制等待页面动画和内容加载
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 注入CSS以展开所有可滚动内容
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = `
        /* 隐藏顶栏 */
        header {
          display: none !important;
        }
        
        /* 移除因顶栏隐藏留下的空白 */
        main, .ant-layout {
          padding-top: 0 !important;
        }
        
        html, body, #app, .ant-layout, .ant-layout-content {
            height: auto !important;
            overflow: visible !important;
        }
      `;
      document.head.appendChild(style);
    });
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });
    console.log(`✅ Generated PDF: ${outputPath}`);
  } catch (error) {
    console.error(`❌ Failed to generate PDF for ${url}:`, error);
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('🚀 Starting PDF generation process...');

  // 启动 Vite 开发服务器
  const viteServer = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: true });
  
  // 等待服务器启动
  console.log('Waiting for dev server to start...');
  await new Promise(resolve => setTimeout(resolve, 15000)); // 等待15秒，确保服务器完全启动

  const browser = await puppeteer.launch({ 
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: "new" 
  });

  try {
    await fs.rm(PDF_OUTPUT_PATH, { recursive: true, force: true });
    await fs.mkdir(PDF_OUTPUT_PATH, { recursive: true });

    const markdownFiles = await findMarkdownFiles(DOCS_PATH);

    for (const file of markdownFiles) {
      const relativePath = path.relative(DOCS_PATH, file);
      const urlPath = relativePath.replace(/\\/g, '/').replace(/\.md$/, '');
      const url = `${BASE_URL}/${urlPath}`;
      const outputPath = path.join(PDF_OUTPUT_PATH, relativePath.replace(/\.md$/, '.pdf'));

      await generatePdf(browser, url, outputPath);
    }
  } catch (error) {
    console.error('An error occurred during PDF generation:', error);
  } finally {
    await browser.close();
    // 结束 Vite 服务器进程
    if (viteServer.pid) {
      exec(`taskkill /PID ${viteServer.pid} /F /T`, (err, stdout, stderr) => {
        if (err) {
          console.error(`Failed to kill process ${viteServer.pid}: ${err.message}`);
          return;
        }
        if (stderr) {
          console.error(`Error killing process ${viteServer.pid}: ${stderr}`);
          return;
        }
        console.log(`Process ${viteServer.pid} killed successfully.`);
      });
    }
    console.log('✅ PDF generation process finished.');
  }
}

main(); 