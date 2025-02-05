// 默认配置
const DEFAULT_CONFIG = {
    apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat'
};

// 日志级别定义
const LOG_LEVELS = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    TRACE: 'TRACE'
};

// 日志级别颜色
const LOG_COLORS = {
    DEBUG: '#7F7F7F',  // 灰色
    INFO: '#2196F3',   // 蓝色
    WARN: '#FF9800',   // 橙色
    ERROR: '#F44336', // 红色
    TRACE: '#4CAF50'  // 绿色
};

// 发送日志到content script
async function sendLog(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logPrefix = `[${timestamp}][${level}]`;
    const color = LOG_COLORS[level];

    // 控制台输出带颜色的日志
    console.log(
        `%c${logPrefix} ${message}`,
        `color: ${color}; font-weight: bold;`,
        data
    );

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.tabs.sendMessage(tab.id, {
                type: 'log',
                level: level,
                message: `${logPrefix} ${message}`,
                data: data,
                color: color
            });
        }
    } catch (error) {
        console.error('发送日志失败:', error);
    }
}

// 便捷日志函数
const logger = {
    debug: (message, data) => sendLog(LOG_LEVELS.DEBUG, message, data),
    info: (message, data) => sendLog(LOG_LEVELS.INFO, message, data),
    warn: (message, data) => sendLog(LOG_LEVELS.WARN, message, data),
    error: (message, data) => sendLog(LOG_LEVELS.ERROR, message, data),
    trace: (message, data) => sendLog(LOG_LEVELS.TRACE, message, data)
};

// 初始化时输出日志
logger.debug('Background script loaded');

// 监听安装事件
chrome.runtime.onInstalled.addListener(() => {
    logger.info('Extension installed');
});

// 处理来自content script的翻译请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const startTime = performance.now();
    logger.debug('收到翻译请求', request);

    if (request.type === 'translate') {
        logger.trace('开始处理翻译', request.text.substring(0, 50) + '...');
        handleTranslation(request.text, request.mode || 'simple')
            .then(result => {
                const endTime = performance.now();
                logger.info('翻译完成', `总耗时: ${(endTime - startTime).toFixed(2)}ms`);
                sendResponse(result);
            })
            .catch(error => {
                const endTime = performance.now();
                logger.error('翻译失败', {
                    error: error.message,
                    timeCost: `${(endTime - startTime).toFixed(2)}ms`
                });
                sendResponse({ error: error.message });
            });
        return true;
    }
});

// 调用API进行翻译
async function handleTranslation(text, mode) {
    const timings = {
        start: performance.now(),
        configLoaded: 0,
        requestSent: 0,
        responseReceived: 0,
        responseJsonParsed: 0,
        contentParsed: 0,
        end: 0
    };

    logger.debug('开始加载配置');

    const config = await new Promise(resolve => {
        chrome.storage.sync.get(['translatorConfig'], (result) => {
            timings.configLoaded = performance.now();
            logger.trace('配置加载完成', `耗时: ${(timings.configLoaded - timings.start).toFixed(2)}ms`);
            resolve(result.translatorConfig || {});
        });
    });

    if (!config.apiKey) {
        logger.warn('未设置API Key');
        throw new Error('请先设置API Key');
    }

    try {
        let messages;
        if (mode === 'annotate') {
            messages = [
                {
                    role: "system",
                    content: `你是一个英语教学助手，帮助中国程序员理解英文文本。你的任务是分析文本中的难词和短语，提供简短的中文释义。注意：1.必须返回严格符合此结构的纯净JSON：{"annotations":[{"word":"术语1","meaning":"释义1"},{"word":"术语2","meaning":"释义2"}]} 2. 只关注真正的难词 3. 释义要简短 4. 不要解析HTML标签 5. 不要包含任何额外的解释`
                },
                {
                    role: "user",
                    content: `请帮我找出下面英文文本中对中国程序员来说最不容易理解的0-5个单词或短语（本科英语水平），并给出简短的中文释义（不超过6个字）。请严格按照JSON格式返回
                            文本内容：
                            ${text}`
                }
            ];
        } else {
            messages = [
                {
                    role: "system",
                    content: "你是一个翻译助手，请将用户输入的英文翻译成中文，只返回翻译结果，不需要解释或其他内容。"
                },
                {
                    role: "user",
                    content: text
                }
            ];
        }

        const requestBody = {
            model: config.modelName || DEFAULT_CONFIG.modelName,
            messages: messages,
            temperature: 0,
            response_format: mode === 'annotate' ? { type: "json_object" } : undefined,
            stream: mode !== 'annotate' // 非注释模式使用流式输出
        };

        logger.debug('发送的请求内容', {
            endpoint: config.apiEndpoint || DEFAULT_CONFIG.apiEndpoint,
            requestBody: requestBody
        });

        logger.trace('准备发送API请求');
        timings.requestSent = performance.now();
        logger.trace('请求准备完成', `耗时: ${(timings.requestSent - timings.configLoaded).toFixed(2)}ms`);

        const response = await fetch(config.apiEndpoint || DEFAULT_CONFIG.apiEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        timings.responseReceived = performance.now();
        logger.debug('收到API响应头', `耗时: ${(timings.responseReceived - timings.requestSent).toFixed(2)}ms`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            logger.error('API错误', errorData);
            throw new Error(errorData.error?.message || `请求失败: ${response.status} ${response.statusText}`);
        }

        // 使用 ReadableStream 处理响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let responseText = '';
        let streamStart = performance.now();
        let bytesReceived = 0;
        let lastProgressUpdate = streamStart;
        let streamResult = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            bytesReceived += value?.length || 0;
            const chunk = decoder.decode(value, { stream: true });
            responseText += chunk;

            // 如果是流式模式，尝试处理部分响应
            if (mode !== 'annotate') {
                try {
                    // 将chunk按行分割，处理每一行
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonData = line.slice(6);
                            if (jsonData === '[DONE]') continue;

                            try {
                                const data = JSON.parse(jsonData);
                                const content = data.choices?.[0]?.delta?.content;
                                if (content) {
                                    streamResult += content;
                                }
                            } catch (e) {
                                // 忽略解析错误，继续处理下一行
                            }
                        }
                    }
                } catch (e) {
                    // 忽略流式处理错误
                }
            }

            // 每100ms更新一次进度
            const now = performance.now();
            if (now - lastProgressUpdate > 100) {
                logger.trace('接收数据中', {
                    '已接收': `${(bytesReceived / 1024).toFixed(2)}KB`,
                    '耗时': `${(now - streamStart).toFixed(2)}ms`,
                    '速度': `${((bytesReceived / 1024) / ((now - streamStart) / 1000)).toFixed(2)}KB/s`
                });
                lastProgressUpdate = now;
            }
        }
        // 处理最后的数据块
        responseText += decoder.decode();

        timings.streamEnd = performance.now();
        logger.debug('响应接收完成', {
            '数据接收耗时': `${(timings.streamEnd - streamStart).toFixed(2)}ms`,
            '总数据量': `${(bytesReceived / 1024).toFixed(2)}KB`,
            '平均速度': `${((bytesReceived / 1024) / ((timings.streamEnd - streamStart) / 1000)).toFixed(2)}KB/s`
        });

        // 如果是流式模式且已经有结果，直接返回
        if (mode !== 'annotate' && streamResult) {
            timings.end = performance.now();
            const timingSummary = {
                '配置加载': `${(timings.configLoaded - timings.start).toFixed(2)}ms`,
                '请求准备': `${(timings.requestSent - timings.configLoaded).toFixed(2)}ms`,
                'API响应': `${(timings.responseReceived - timings.requestSent).toFixed(2)}ms`,
                '数据接收': `${(timings.streamEnd - streamStart).toFixed(2)}ms`,
                '总耗时': `${(timings.end - timings.start).toFixed(2)}ms`
            };
            logger.info('流式翻译完成', {
                timings: timingSummary,
                result: streamResult.trim()
            });
            return { translation: streamResult.trim() };
        }

        let data;
        try {
            const parseStart = performance.now();
            data = JSON.parse(responseText);
            timings.contentParsed = performance.now();
            logger.debug('响应解析完成', {
                '解析耗时': `${(timings.contentParsed - parseStart).toFixed(2)}ms`,
                '数据大小': `${(responseText.length / 1024).toFixed(2)}KB`
            });
        } catch (error) {
            logger.error('JSON解析失败', { error: error.message });
            throw new Error('响应数据格式错误');
        }

        if (mode === 'annotate') {
            try {
                // 解析返回的JSON
                let parsedData;
                const startContentParse = performance.now();

                // 记录原始响应
                logger.debug('API原始响应', {
                    data: data,
                    type: typeof data,
                    hasChoices: !!data.choices,
                    choicesLength: data.choices?.length
                });

                // 尝试直接获取content
                const content = data.choices?.[0]?.message?.content;
                if (!content) {
                    logger.error('响应格式错误', {
                        data: data,
                        choices: data.choices,
                        firstChoice: data.choices?.[0]
                    });
                    throw new Error('响应数据格式错误：找不到content字段');
                }

                logger.debug('API响应content字段', {
                    content: content,
                    type: typeof content,
                    length: content.length
                });

                if (typeof content === 'string') {
                    try {
                        parsedData = JSON.parse(content);
                        logger.debug('解析后的JSON数据', {
                            parsedData: parsedData,
                            hasAnnotations: !!parsedData.annotations,
                            annotationsLength: parsedData.annotations?.length
                        });
                        logger.trace('内容JSON解析成功', `耗时: ${(performance.now() - startContentParse).toFixed(2)}ms`);
                    } catch (error) {
                        logger.error('内容JSON解析失败', {
                            error: error.message,
                            content: content,
                            contentPreview: content.substring(0, 200)
                        });
                        throw new Error('注释数据格式错误');
                    }
                } else {
                    // content已经是对象了，直接使用
                    parsedData = content;
                    logger.debug('Content已经是对象', parsedData);
                }

                // 验证数据格式
                if (!parsedData.annotations || !Array.isArray(parsedData.annotations)) {
                    logger.error('数据格式验证失败', {
                        parsedData: parsedData,
                        type: typeof parsedData,
                        hasAnnotations: !!parsedData.annotations,
                        annotationsType: typeof parsedData.annotations
                    });
                    throw new Error('API返回的数据格式不正确');
                }

                timings.end = performance.now();
                const timingSummary = {
                    '配置加载': `${(timings.configLoaded - timings.start).toFixed(2)}ms`,
                    '请求准备': `${(timings.requestSent - timings.configLoaded).toFixed(2)}ms`,
                    'API响应': `${(timings.responseReceived - timings.requestSent).toFixed(2)}ms`,
                    '数据接收': `${(timings.streamEnd - streamStart).toFixed(2)}ms`,
                    'JSON解析': `${(timings.contentParsed - timings.streamEnd).toFixed(2)}ms`,
                    '内容处理': `${(timings.end - timings.contentParsed).toFixed(2)}ms`,
                    '总耗时': `${(timings.end - timings.start).toFixed(2)}ms`
                };
                logger.info('注释处理完成', timingSummary);

                return { annotations: parsedData.annotations };
            } catch (error) {
                logger.error('注释解析失败', error.message);
                throw new Error('注释数据格式错误');
            }
        } else {
            const content = data.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('响应数据格式错误');
            }

            timings.end = performance.now();
            const timingSummary = {
                '配置加载': `${(timings.configLoaded - timings.start).toFixed(2)}ms`,
                '请求准备': `${(timings.requestSent - timings.configLoaded).toFixed(2)}ms`,
                'API响应': `${(timings.responseReceived - timings.requestSent).toFixed(2)}ms`,
                '数据接收': `${(timings.streamEnd - streamStart).toFixed(2)}ms`,
                'JSON解析': `${(timings.contentParsed - timings.streamEnd).toFixed(2)}ms`,
                '内容处理': `${(timings.end - timings.contentParsed).toFixed(2)}ms`,
                '总耗时': `${(timings.end - timings.start).toFixed(2)}ms`
            };
            logger.info('翻译完成', timingSummary);

            return { translation: content.trim() };
        }
    } catch (error) {
        logger.error('请求失败', error.message);
        throw error;
    }
} 