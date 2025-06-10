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
  role: 1 << 1,//2
  root: 1 << 2,//4
  event: 1 << 3,//8
  btn: 1 << 4,//16
  version: 1 << 5,//32
  end: 1 << 6,//64
  'zhao-cha': 1 << 7,//128
  fail: 1 << 8,
  succ: 1 << 9,
  isPROCESS(type) {
    const PROCESS = NodeType.text | NodeType.event
      | NodeType.btn | NodeType.end
      | NodeType['zhao-cha'] | NodeType.fail
      | NodeType.succ | NodeType.root;
    return (PROCESS & type) == type;
  },
  isROOT(type) {
    return (NodeType.root & type) == type;
  },
  isZHAOCHARESULT(type) {
    const ZHAOCHARESULT = NodeType.fail | NodeType.succ
    return (ZHAOCHARESULT & type) == type;
  },
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
    name: '剧本',
    version: '0.0.0',
    roles: {},
    entities: {},
    root: '',
  }
  for (const entity of data.entities) {
    if (entity.type != 'core:text_node') {
      throw `意外的实体类型: ${entity.type} ${JSON.stringify(entity)}`
    }
    const text = entity.text.split('\n') as string[]
    const type = NodeType[text[0]];
    if (type == undefined) {
      throw `意外的节点类型: ${type} ${JSON.stringify(entity)}`
    }
    if (type == NodeType.version) {
      result.version = text[1]
    } else if (type == NodeType.role) {
      const info = {} as any
      for (const item of text.slice(1)) {
        const split = item.split(/[:：]/g);
        if (split.length != 2) {
          throw `role 节点参数错误: ${JSON.stringify(entity)}`
        }
        info[split[0]] = split[1];
      }
      if (info['id'] == undefined) {
        throw `role 节点参数错误: ${JSON.stringify(entity)}`
      }
      result.roles[info['id']] = info;
    } else if (NodeType.isPROCESS(type)) {
      result.entities[entity.uuid] = {
        type: type,
        text: text.slice(1),
        children: []
      }
    } else {
      throw `该节点类型未处理:${type}`
    }
    if (NodeType.isROOT(type)) {
      result.name = text[1] ?? result.name;
      result.root = entity.uuid;
    }
  }
  // 子节点绑定
  for (const edge of data.associations) {
    const source = result.entities[edge.source];
    if (source == undefined) {
      throw `未找到节点uuid: ${edge.source}`
    }
    source.children.push(edge.target)
  }
  // 节点验证 待完成
  for (const uuid in result.entities) {
    const entity = result.entities[uuid]
    if (NodeType.isROOT(entity.type)) {
      if (entity.children.length !== 1) {
        throw `root 节点验证失败`
      }
    } else if (NodeType.text == entity.type) {

    }
  }
  return result;
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