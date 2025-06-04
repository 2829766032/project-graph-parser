#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { text } from 'stream/consumers';
import { fileURLToPath } from 'url';

// 获取当前模块路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建命令行程序
const program = new Command();

program
  .name('project-graph-parser')
  .description('解析 JSON 文件并输出处理结果')
  .argument('<options-path>', 'options.json 文件路径')
  .action(executeParser)
  .parseAsync()
  .catch(handleGlobalError);
const NodeType = {
  none: 0,
  text: 1 << 0,
  role: 1 << 1,
  root: 1 << 2,
  event: 1 << 3,
  btn: 1 << 4,
  version: 1 << 5,
  end: 1 << 6,
  zhao_cha: 1 << 7,
  fail: 1 << 8,
  succ: 1 << 9,
  get ROOT() { return NodeType.role },
  get PROCESS() { return NodeType.text | NodeType.event | NodeType.btn | NodeType.end | NodeType.zhao_cha | NodeType.fail | NodeType.succ },
  get ZHAOCHARESULT() { return NodeType.fail | NodeType.succ },
}

const NodeTypeMap = {
  'root': {
    input: {
      type: NodeType.none,
      num: 0
    },
    output: {
      type: NodeType.PROCESS,
      num: 1
    }
  },
  'role': {},
  'event': {},
  'btn': {},
  'text': {},
  'version': {},
  'end': {},
  'zhao-cha': {},
  'fail': {},
  'succ': {},
}

// 主执行函数
async function executeParser(optionsPath: string) {
  try {
    // 解析 options.json 绝对路径
    const resolvedOptionsPath = path.resolve(process.cwd(), optionsPath);
    const optionsDir = path.dirname(resolvedOptionsPath);

    // 读取并解析 options.json
    const options = await readOptionsFile(resolvedOptionsPath);

    // 处理每个输入目录
    for (const inputDir of options.input) {
      await processInputDirectory(
        path.join(optionsDir, inputDir),
        path.join(optionsDir, options.output, inputDir)
      );
    }

    console.log('✅ 所有文件处理完成');
  } catch (error) {
    handleOperationError('处理过程中发生错误', error);
  }
}

// 读取 options.json 文件
async function readOptionsFile(filePath: string): Promise<{ input: string[]; output: string }> {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    handleOperationError('读取 options.json 失败', error);
    throw error; // 抛出错误终止后续操作
  }
}

// 处理输入目录
async function processInputDirectory(inputPath: string, outputPath: string) {
  try {
    // 确保输出目录存在
    await fs.mkdir(outputPath, { recursive: true });

    // 读取输入目录下的文件列表
    const files = await fs.readdir(inputPath);

    // 筛选出 JSON 文件
    const jsonFiles = files.filter(file =>
      path.extname(file).toLowerCase() === '.json'
    );

    // 处理每个 JSON 文件
    for (const jsonFile of jsonFiles) {
      const inputFilePath = path.join(inputPath, jsonFile);
      const outputFilePath = path.join(outputPath, jsonFile);

      await processJsonFile(inputFilePath, outputFilePath);
    }

    console.log(`📁 目录 ${path.basename(inputPath)} 处理完成`);
  } catch (error) {
    handleOperationError(`处理目录 ${inputPath} 失败`, error);
  }
}

// 处理单个 JSON 文件 (这里是预留的解析逻辑)
async function processJsonFile(inputPath: string, outputPath: string) {
  try {
    // 读取原始 JSON 文件
    const rawData = await fs.readFile(inputPath, 'utf8');
    const jsonData = JSON.parse(rawData);

    // 预留解析逻辑
    const parsedData = await yourCustomParser(jsonData);

    // 写入处理后的数据
    await fs.writeFile(
      outputPath,
      JSON.stringify(parsedData, null, 2), // 格式化输出
      'utf8'
    );

    console.log(`🔄 文件 ${path.basename(inputPath)} 处理完成`);
  } catch (error) {
    handleOperationError(`处理文件 ${inputPath} 失败`, error);
  }
}

// 预留的自定义解析函数 (由你实现具体逻辑)
async function yourCustomParser(data: any): Promise<any> {
  /* 
  在此处实现你的自定义解析逻辑
  参数 data: 从输入文件解析的 JSON 对象
  返回: 处理后的新 JSON 对象
  */
  let result = {
    entities: {}
  }
  for (const entity of data.entities) {
    if (entity.type != 'core:text_node') {
      throw `意外的实体类型: ${entity.type} ${JSON.stringify(entity)}`
    }
    const type = entity.text.split('\n')[0];
    if (NodeTypeMap[type] == undefined) {
      throw `意外的节点类型: ${type} ${JSON.stringify(entity)}`
    }
    return data; // 示例直接返回原数据
  }
}
// 错误处理函数
function handleOperationError(context: string, error: unknown) {
  console.error(`❌ ${context}:`);
  console.error(error instanceof Error ? error.message : error);
}

function handleGlobalError(error: unknown) {
  console.error('❌ 程序发生未捕获错误:');
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
}