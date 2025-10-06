import puppeteer from 'puppeteer';
import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { PDFDocument } from 'pdf-lib';

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
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.markdown-body', { visible: true });
    
    // 自动滚动页面以触发懒加载内容
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // 等待一小段时间让内容渲染
    await new Promise(resolve => setTimeout(resolve, 3000));
    
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
        /* 移除页脚，防止遮挡 */
        .ant-layout-footer {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    });
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      scale: 0.9, // 缩小页面内容
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

async function mergePdfs(pdfPaths, outputPath) {
  const mergedPdf = await PDFDocument.create();
  for (const pdfPath of pdfPaths) {
    const pdfBytes = await fs.readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => {
      mergedPdf.addPage(page);
    });
  }
  const mergedPdfBytes = await mergedPdf.save();
  await fs.writeFile(outputPath, mergedPdfBytes);
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

    const pdfPaths = [];

    for (const file of markdownFiles) {
      const relativePath = path.relative(DOCS_PATH, file);
      const urlPath = relativePath.replace(/\\/g, '/').replace(/\.md$/, '');
      const url = `${BASE_URL}/${urlPath}`;
      const outputPath = path.join(PDF_OUTPUT_PATH, relativePath.replace(/\.md$/, '.pdf'));

      await generatePdf(browser, url, outputPath);
      pdfPaths.push(outputPath);
    }

    await browser.close();

    console.log('所有PDF页面已生成，现在开始合并...');
    const mergedOutputPath = path.join(PDF_OUTPUT_PATH, 'Operit使用手册.pdf');
    await mergePdfs(pdfPaths, mergedOutputPath);
    console.log(`所有PDF已合并到 ${mergedOutputPath}`);

    console.log('PDF导出完成');
  } catch (error) {
    console.error('An error occurred during PDF generation:', error);
  } finally {
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