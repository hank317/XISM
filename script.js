// 全局变量
let networks = []; // 动态数量的网络图实例
let nodeDatasets = []; // 动态数量的独立节点数据集
let edgeDatasets = []; // 动态数量的独立边数据集
let nodeIdCounters = []; // 每个图的节点ID计数器
let selectedNodes = [];
let selectedEdges = [];
let currentFormsData = []; // 存储当前的forms数据
let highlightedNodes = []; // 存储当前高亮的节点
let originalExcelData = []; // 存储原始Excel数据

let isBeautified = false; // 跟踪图形美化状态

let currentEditEdgeId = null;
let currentSlideIndex = 0; // 当前显示的轮播图索引
let totalSlides = 0; // 总幻灯片数量
let evaluationMetricsData = []; // 存储所有语义地图的评价指标数据

// Merge功能相关的状态管理
let isMergedStates = []; // 每个地图的merge状态数组
let backupEvaluationMetricsArray = []; // 每个地图备份merge前的评价指标
let backupUnconnectedFormsArray = []; // 每个地图备份merge前的未连接表单
let mergedEdgeIdsArray = []; // 每个地图存储merge的边ID数组

// 配置网络图选项
const options = {
    nodes: {
        shape: 'circle',
        font: {
            size: 16,
            face: 'Arial'
        },
        borderWidth: 2,
        shadow: false
    },
    edges: {
        shadow: false,
        font: {
            size: 12,
            align: 'middle',
            background: 'white',
            strokeWidth: 1,
            strokeColor: '#000000'
        },
        arrows: {
            to: { enabled: false }
        },
        color: {
            color: '#FFCCE5',       // 浅粉色
            highlight: '#FF69B4',   // 深粉色（热粉色）
            hover: '#FF69B4'        // 鼠标悬停时显示深粉色
        },
        chosen: {
            label: false
        },
        labelHighlightBold: false
    },
    physics: {
        enabled: true,
        barnesHut: {
            gravitationalConstant: -2000,
            centralGravity: 0.3,
            springLength: 150,
            springConstant: 0.04
        }
    },
    interaction: {
        hover: true,
        multiselect: true,
        navigationButtons: true,
        dragNodes: true,
        dragView: true,
        zoomView: true
    },
    manipulation: {
        enabled: false
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化空的数据集数组
    nodeDatasets = [];
    edgeDatasets = [];
    networks = [];
    
    // 不再自动初始化网络图，等待用户上传文件后动态创建
    
    // 初始化筛选功能
    initializeFormFilter();
    
    // 初始化文件信息显示
    const fileInfo = document.getElementById('file-info');
    fileInfo.textContent = 'No file selected';
    
    // 绑定按钮事件
    document.getElementById('upload-btn').addEventListener('click', handleFileUpload);
    document.getElementById('download-guide-btn').addEventListener('click', handleDownloadGuide);
    document.getElementById('example-btn').addEventListener('click', handleExampleUpload);
document.getElementById('example-btn-2').addEventListener('click', handleExampleUpload2);
document.getElementById('example-btn-3').addEventListener('click', handleExampleUpload3);
    document.getElementById('help-btn').addEventListener('click', showHelpModal);
    
    // 绑定自定义文件选择按钮事件
    document.getElementById('file-select-btn').addEventListener('click', function() {
        document.getElementById('excel-file').click();
    });
    
    // 绑定文件输入change事件
    document.getElementById('excel-file').addEventListener('change', function() {
        const fileInfo = document.getElementById('file-info');
        const fileSelectBtn = document.getElementById('file-select-btn');
        if (this.files && this.files.length > 0) {
            const fileName = this.files[0].name;
            fileInfo.textContent = `Selected file: ${fileName}`;
            fileSelectBtn.textContent = fileName;
        } else {
             fileInfo.textContent = 'No file selected';
             fileSelectBtn.textContent = 'Choose File';
         }
     });
    document.getElementById('add-edge-btn').addEventListener('click', showAddEdgeForm);
    document.getElementById('edit-edge-btn').addEventListener('click', showEditEdgeForm);
    document.getElementById('delete-edge-btn').addEventListener('click', deleteSelectedEdge);
    document.getElementById('merge-edge-btn').addEventListener('click', function() {
        const currentIndex = currentSlideIndex;
        if (isMergedStates[currentIndex]) {
            restoreMerge();
        } else {
            mergeEdges();
        }
    });
    document.getElementById('center-btn').addEventListener('click', centerGraph);
    document.getElementById('beautiful-btn').addEventListener('click', beautifyGraph);
    document.getElementById('download-btn').addEventListener('click', downloadGraph);

    document.getElementById('confirm-add-edge').addEventListener('click', addEdge);
    document.getElementById('cancel-add-edge').addEventListener('click', hideAddEdgeForm);
    document.getElementById('confirm-edit-edge').addEventListener('click', updateEdge);
    document.getElementById('cancel-edit-edge').addEventListener('click', hideEditEdgeForm);
    
    // 绑定轮播控制事件
    document.getElementById('prev-btn').addEventListener('click', showPreviousSlide);
    document.getElementById('next-btn').addEventListener('click', showNextSlide);
    
    // 绑定指示器点击事件
    const indicators = document.querySelectorAll('.indicator');
    indicators.forEach(indicator => {
        indicator.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            showSlide(index);
        });
    });
});

// 初始化筛选功能
function initializeFormFilter() {
    const filterBtn = document.getElementById('form-filter-btn');
    const filterMenu = document.getElementById('form-filter-menu');
    
    if (!filterBtn || !filterMenu) {
        return; // 如果元素不存在，直接返回
    }
    
    // 点击按钮显示/隐藏下拉菜单
    filterBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const isVisible = filterMenu.style.display === 'block';
        filterMenu.style.display = isVisible ? 'none' : 'block';
    });
    
    // 点击其他地方隐藏下拉菜单
    document.addEventListener('click', function() {
        filterMenu.style.display = 'none';
    });
    
    // 阻止菜单内部点击事件冒泡
    filterMenu.addEventListener('click', function(e) {
        e.stopPropagation();
    });
}

// 更新筛选模块
function updateFormFilter(formsData) {
    const filterMenu = document.getElementById('form-filter-menu');
    const filterBtn = document.getElementById('form-filter-btn');
    
    if (!filterMenu || !filterBtn) {
        return; // 如果元素不存在，直接返回
    }
    
    // 清空现有选项
    filterMenu.innerHTML = '';
    
    // 添加"All Forms"选项
    const allOption = document.createElement('div');
    allOption.className = 'dropdown-item selected';
    allOption.textContent = 'All Forms';
    allOption.dataset.form = 'all';
    allOption.addEventListener('click', function() {
        selectFormFilter('all', 'All Forms');
    });
    filterMenu.appendChild(allOption);
    
    // 添加每个form选项
    formsData.forEach((formData, index) => {
        const option = document.createElement('div');
        option.className = 'dropdown-item';
        option.textContent = `${formData.form} (${formData.language})`;
        option.dataset.form = index;
        option.addEventListener('click', function() {
            selectFormFilter(index, `${formData.form} (${formData.language})`);
        });
        filterMenu.appendChild(option);
    });
    
    // 重置按钮文本
    filterBtn.textContent = 'All Forms ▼';
}

// 选择筛选项
function selectFormFilter(formIndex, displayText) {
    const filterBtn = document.getElementById('form-filter-btn');
    const filterMenu = document.getElementById('form-filter-menu');
    
    if (!filterBtn || !filterMenu) {
        return;
    }
    
    const dropdownItems = filterMenu.querySelectorAll('.dropdown-item');
    
    // 更新选中状态
    dropdownItems.forEach(item => item.classList.remove('selected'));
    if (formIndex === 'all') {
        dropdownItems[0].classList.add('selected');
    } else {
        dropdownItems[formIndex + 1].classList.add('selected');
    }
    
    // 更新按钮文本
    filterBtn.textContent = displayText + ' ▼';
    
    // 隐藏下拉菜单
    filterMenu.style.display = 'none';
    
    // 高亮对应节点
    highlightFormNodes(formIndex);
}

// 高亮form对应的节点
function highlightFormNodes(formIndex) {
    // 清除之前的高亮
    clearNodeHighlight();
    
    if (formIndex === 'all' || !window.currentFormsData || !window.currentFormsData[formIndex]) {
        return;
    }
    
    const formData = window.currentFormsData[formIndex];
    const nodeIds = formData.nodes;
    
    // 高亮所有网络中的对应节点
    networks.forEach(network => {
        if (network) {
            const nodes = network.body.data.nodes;
            const updateNodes = [];
            
            nodeIds.forEach(nodeId => {
                const node = nodes.get(nodeId);
                if (node) {
                    updateNodes.push({
                        id: nodeId,
                        color: {
                            background: '#ffeb3b', // 浅黄色
                            border: '#fbc02d'
                        }
                    });
                    highlightedNodes.push(nodeId);
                }
            });
            
            if (updateNodes.length > 0) {
                nodes.update(updateNodes);
            }
        }
    });
}

// 清除节点高亮
function clearNodeHighlight() {
    networks.forEach(network => {
        if (network && highlightedNodes.length > 0) {
            const nodes = network.body.data.nodes;
            const updateNodes = [];
            
            highlightedNodes.forEach(nodeId => {
                const node = nodes.get(nodeId);
                if (node) {
                    updateNodes.push({
                        id: nodeId,
                        color: {
                            background: '#97c2fc', // 恢复默认颜色
                            border: '#2b7ce9'
                        }
                    });
                }
            });
            
            if (updateNodes.length > 0) {
                nodes.update(updateNodes);
            }
        }
    });
    
    highlightedNodes = [];
}

// 初始化多个网络图（现在由updateGraph函数动态调用）
function initializeNetworks(count) {
    // 根据实际数量初始化网络图
    for (let i = 0; i < count; i++) {
        const container = document.getElementById(`graph-container-${i+1}`);
        
        // 确保容器存在
        if (!container) {
            console.error(`Container graph-container-${i+1} not found`);
            continue;
        }
        
        // 为每个图创建独立的数据对象
        const data = {
            nodes: nodeDatasets[i],
            edges: edgeDatasets[i]
        };
        
        // 为第一个图创建优化配置，减少性能负担
        let networkOptions = options;
        if (i === 0) {
            networkOptions = {
                ...options,
                physics: {
                    enabled: true,
                    stabilization: {
                        enabled: true,
                        iterations: 100,
                        updateInterval: 25
                    },
                    barnesHut: {
                        gravitationalConstant: -1000,
                        centralGravity: 0.1,
                        springLength: 100,
                        springConstant: 0.02
                    }
                }
            };
        }
        
        networks[i] = new vis.Network(container, data, networkOptions);
        
        // 添加选择事件监听
        networks[i].on('click', (function(index) {
            return function(params) {
                selectedNodes = params.nodes;
                selectedEdges = params.edges;
                
                // 更新当前图的索引
                currentSlideIndex = index;
            };
        })(i));
    }
    
    // 显示第一个轮播图
    if (count > 0) {
        showSlide(0);
    }
}

// 不再需要同步所有图的选择状态

// 轮播控制函数
function showSlide(index) {
    // 获取所有轮播图和指示器
    const slides = document.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll('.indicator');
    
    // 确保索引在有效范围内
    if (index < 0 || index >= slides.length) {
        return;
    }
    
    // 隐藏所有轮播图并移除指示器的活动状态
    slides.forEach(slide => slide.classList.remove('active'));
    indicators.forEach(indicator => indicator.classList.remove('active'));
    
    // 显示指定索引的轮播图并激活对应的指示器
    slides[index].classList.add('active');
    indicators[index].classList.add('active');
    
    // 更新当前索引
    currentSlideIndex = index;
    
    // 更新merge按钮状态
    const mergeBtn = document.getElementById('merge-edge-btn');
    if (mergeBtn) {
        if (isMergedStates[index]) {
            mergeBtn.textContent = 'Restore Merge';
        } else {
            mergeBtn.textContent = 'Merge Edge';
        }
    }
    
    // 更新当前显示的评价指标
    // 无论是否有评估数据，都调用updateEvaluationMetrics来确保正确显示
    updateEvaluationMetrics(index, evaluationMetricsData[index] || null);
    
    // 重新绘制当前显示的网络图
    if (networks[index]) {
        networks[index].redraw();
        // 只在初始化时或数据更新后才调用fit，避免影响用户的视图状态
        // networks[index].fit();
    }
}

function showNextSlide() {
    const slides = document.querySelectorAll('.carousel-slide');
    const nextIndex = (currentSlideIndex + 1) % slides.length;
    showSlide(nextIndex);
}

function showPreviousSlide() {
    const slides = document.querySelectorAll('.carousel-slide');
    const prevIndex = (currentSlideIndex - 1 + slides.length) % slides.length;
    showSlide(prevIndex);
}

// 处理文件上传
async function handleFileUpload() {
    const fileInput = document.getElementById('excel-file');
    const fileInfo = document.getElementById('file-info');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select an Excel file first');
        return;
    }
    
    const file = fileInput.files[0];
    fileInfo.textContent = `Selected file: ${file.name}`;
    
    try {
        // 读取Excel文件
        const data = await readExcelFile(file);
        
        // 保存原始Excel数据供merge edges功能使用
        originalExcelData = data;
        
        // 尝试发送数据到后端处理
        try {
            const response = await sendDataToBackend(data);
            // 检查返回的数据格式
            if (response.graph_data && response.forms_with_nodes) {
                // 新格式：包含graph_data和forms_with_nodes
                const graphDataArray = response.graph_data;
                const formsWithNodes = response.forms_with_nodes;
                
                // 存储forms数据供筛选功能使用
                window.currentFormsData = formsWithNodes;
                
                updateGraph(graphDataArray);
                updateGraphTitles(file.name, graphDataArray);
                
                // 更新筛选模块
                updateFormFilter(formsWithNodes);
            } else if (Array.isArray(response)) {
                // 兼容旧格式：直接返回数组
                updateGraph(response);
                updateGraphTitles(file.name, response);
                window.currentFormsData = [];
                updateFormFilter([]);
            } else {
                // 兼容旧格式：单个语义地图
                updateGraph([response]);
                updateGraphTitles(file.name, [response]);
                window.currentFormsData = [];
                updateFormFilter([]);
            }
        } catch (error) {
            console.error('后端处理失败:', error);
            // 后端处理失败，显示错误信息
            fileInfo.textContent = `后端处理失败: ${error.message}`;
            return;
        }
    } catch (error) {
        console.error('文件处理失败:', error);
        fileInfo.textContent = `文件处理失败: ${error.message}`;
    }
}

// 处理示例文件上传
async function handleExampleUpload() {
    const fileInfo = document.getElementById('file-info');
    
    try {
        // 显示加载状态
        fileInfo.textContent = 'Loading example file...';
        
        // 获取示例文件
        const response = await fetch('data/EAT verbs.xlsx');
        if (!response.ok) {
            throw new Error(`Failed to load example file: ${response.status}`);
        }
        
        // 将响应转换为Blob
        const blob = await response.blob();
        
        // 创建File对象
        const file = new File([blob], 'EAT verbs.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        
        // 更新文件信息显示
        fileInfo.textContent = `Loaded example file: ${file.name}`;
        
        // 读取Excel文件
        const data = await readExcelFile(file);
        
        // 保存原始Excel数据供merge edges功能使用
        originalExcelData = data;
        
        // 尝试发送数据到后端处理
        try {
            const response = await sendDataToBackend(data);
            // 检查返回的数据格式
            if (response.graph_data && response.forms_with_nodes) {
                // 新格式：包含graph_data和forms_with_nodes
                const graphDataArray = response.graph_data;
                const formsWithNodes = response.forms_with_nodes;
                
                // 存储forms数据供筛选功能使用
                window.currentFormsData = formsWithNodes;
                
                updateGraph(graphDataArray);
                updateGraphTitles(file.name, graphDataArray);
                
                // 更新筛选模块
                updateFormFilter(formsWithNodes);
            } else if (Array.isArray(response)) {
                // 兼容旧格式：直接返回数组
                updateGraph(response);
                updateGraphTitles(file.name, response);
                window.currentFormsData = [];
                updateFormFilter([]);
            } else {
                // 兼容旧格式：单个语义地图
                updateGraph([response]);
                updateGraphTitles(file.name, [response]);
                window.currentFormsData = [];
                updateFormFilter([]);
            }
        } catch (error) {
            console.error('后端处理失败:', error);
            // 后端处理失败，显示错误信息
            fileInfo.textContent = `后端处理失败: ${error.message}`;
            return;
        }
    } catch (error) {
        console.error('示例文件加载失败:', error);
        fileInfo.textContent = `示例文件加载失败: ${error.message}`;
    }
}

// 处理示例文件2上传
async function handleExampleUpload2() {
    const fileInfo = document.getElementById('file-info');
    
    try {
        // 显示加载状态
        fileInfo.textContent = 'Loading example file 2...';
        
        // 获取示例文件
        const response = await fetch('data/supplementary adverbs.xlsx');
        if (!response.ok) {
            throw new Error(`Failed to load example file: ${response.status}`);
        }
        
        // 将响应转换为Blob
        const blob = await response.blob();
        
        // 创建File对象
        const file = new File([blob], 'supplementary adverbs.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        
        // 更新文件信息显示
        fileInfo.textContent = `Loaded example file: ${file.name}`;
        
        // 读取Excel文件
        const data = await readExcelFile(file);
        
        // 保存原始Excel数据供merge edges功能使用
        originalExcelData = data;
        
        // 尝试发送数据到后端处理
        try {
            const response = await sendDataToBackend(data);
            // 检查返回的数据格式
            if (response.graph_data && response.forms_with_nodes) {
                // 新格式：包含graph_data和forms_with_nodes
                const graphDataArray = response.graph_data;
                const formsWithNodes = response.forms_with_nodes;
                
                // 存储forms数据供筛选功能使用
                window.currentFormsData = formsWithNodes;
                
                updateGraph(graphDataArray);
                updateGraphTitles(file.name, graphDataArray);
                
                // 更新筛选模块
                updateFormFilter(formsWithNodes);
            } else if (Array.isArray(response)) {
                // 兼容旧格式：直接返回数组
                updateGraph(response);
                updateGraphTitles(file.name, response);
                window.currentFormsData = [];
                updateFormFilter([]);
            } else {
                // 兼容旧格式：单个语义地图
                updateGraph([response]);
                updateGraphTitles(file.name, [response]);
                window.currentFormsData = [];
                updateFormFilter([]);
            }
        } catch (error) {
            console.error('后端处理失败:', error);
            // 后端处理失败，显示错误信息
            fileInfo.textContent = `后端处理失败: ${error.message}`;
            return;
        }
    } catch (error) {
        console.error('示例文件加载失败:', error);
        fileInfo.textContent = `示例文件加载失败: ${error.message}`;
    }
}

// 处理示例文件3上传
async function handleExampleUpload3() {
    const fileInfo = document.getElementById('file-info');
    
    try {
        // 显示加载状态
        fileInfo.textContent = 'Loading example file 3...';
        
        // 获取示例文件
        const response = await fetch('data/ditransitive constructions.xlsx');
        if (!response.ok) {
            throw new Error(`Failed to load example file: ${response.status}`);
        }
        
        // 将响应转换为Blob
        const blob = await response.blob();
        
        // 创建File对象
        const file = new File([blob], 'ditransitive constructions.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        
        // 更新文件信息显示
        fileInfo.textContent = `Loaded example file: ${file.name}`;
        
        // 读取Excel文件
        const data = await readExcelFile(file);
        
        // 保存原始Excel数据供merge edges功能使用
        originalExcelData = data;
        
        // 尝试发送数据到后端处理
        try {
            const response = await sendDataToBackend(data);
            // 检查返回的数据格式
            if (response.graph_data && response.forms_with_nodes) {
                // 新格式：包含graph_data和forms_with_nodes
                const graphDataArray = response.graph_data;
                const formsWithNodes = response.forms_with_nodes;
                
                // 存储forms数据供筛选功能使用
                window.currentFormsData = formsWithNodes;
                
                updateGraph(graphDataArray);
                updateGraphTitles(file.name, graphDataArray);
                
                // 更新筛选模块
                updateFormFilter(formsWithNodes);
            } else if (Array.isArray(response)) {
                // 兼容旧格式：直接返回数组
                updateGraph(response);
                updateGraphTitles(file.name, response);
                window.currentFormsData = [];
                updateFormFilter([]);
            } else {
                // 兼容旧格式：单个语义地图
                updateGraph([response]);
                updateGraphTitles(file.name, [response]);
                window.currentFormsData = [];
                updateFormFilter([]);
            }
        } catch (error) {
            console.error('后端处理失败:', error);
            // 后端处理失败，显示错误信息
            fileInfo.textContent = `后端处理失败: ${error.message}`;
            return;
        }
    } catch (error) {
        console.error('示例文件加载失败:', error);
        fileInfo.textContent = `示例文件加载失败: ${error.message}`;
    }
}

// 处理下载指南文件
async function handleDownloadGuide() {
    try {
        // 获取guidance and examples.zip文件
        const response = await fetch('data/guidance and examples.zip');
        if (!response.ok) {
            throw new Error(`Failed to load guide file: ${response.status}`);
        }
        
        // 将响应转换为Blob
        const blob = await response.blob();
        
        // 创建下载链接
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'guidance and examples.zip';
        
        // 添加到DOM并触发下载
        document.body.appendChild(a);
        a.click();
        
        // 清理
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('Guide file downloaded successfully');
    } catch (error) {
        console.error('下载指南文件失败:', error);
        alert('下载指南文件失败，请稍后重试。');
    }
}

// 动态创建轮播图幻灯片和指示器
function createCarouselSlides(count) {
    const slidesContainer = document.querySelector('.carousel-slides');
    const indicatorsContainer = document.querySelector('.carousel-indicators');
    
    // 清空现有内容
    slidesContainer.innerHTML = '';
    indicatorsContainer.innerHTML = '';
    
    // 创建幻灯片
    for (let i = 0; i < count; i++) {
        // 创建幻灯片
        const slide = document.createElement('div');
        slide.className = `carousel-slide ${i === 0 ? 'active' : ''}`;
        
        const title = document.createElement('h3');
        title.className = 'graph-title';
        title.textContent = `Semantic Map`;
        
        const container = document.createElement('div');
        container.id = `graph-container-${i + 1}`;
        container.className = 'graph-container';
        
        slide.appendChild(title);
        slide.appendChild(container);
        slidesContainer.appendChild(slide);
        
        // 创建指示器
        const indicator = document.createElement('span');
        indicator.className = `indicator ${i === 0 ? 'active' : ''}`;
        indicator.setAttribute('data-index', i);
        indicator.addEventListener('click', () => showSlide(i));
        indicatorsContainer.appendChild(indicator);
    }
}

// 更新评价指标显示
function updateEvaluationMetrics(slideIndex, evaluationMetric) {
    console.log('Updating evaluation metrics for slide:', slideIndex, 'with data:', evaluationMetric);
    // 查找固定的评价指标面板
    const metricsPanel = document.querySelector('.evaluation-metrics-panel');
    if (!metricsPanel) {
        console.warn('Evaluation metrics panel not found');
        return;
    }
    // 如果没有评价指标数据，显示默认值
    if (!evaluationMetric) {
        console.warn('No evaluation metric data provided for slide:', slideIndex + 1);
        const metricValues = metricsPanel.querySelectorAll('.metric-value');
        metricValues.forEach(value => {
            value.textContent = 'N/A';
        });
        // 清空未连接表单显示
        updateUnconnectedForms([]);
        return;
    }
    // 更新各个指标值
    const metricMapping = {
        'acc': evaluationMetric.acc,
        'prec': evaluationMetric.prec,
        'recall': evaluationMetric.recall,
        'F1': evaluationMetric.F1,
        'productivity': evaluationMetric.productivity,
        'coverage': evaluationMetric.coverage,
        'weight_sum': evaluationMetric.weight_sum,
        'deg_mean': evaluationMetric.deg_mean,
        'deg_std': evaluationMetric.deg_std
    };
    Object.keys(metricMapping).forEach(key => {
        const valueElement = metricsPanel.querySelector(`[data-metric="${key}"]`);
        if (valueElement) {
            const value = metricMapping[key];
            if (value !== undefined && value !== null) {
                // 格式化数值，保留三位小数
                valueElement.textContent = typeof value === 'number' ? value.toFixed(3) : value;
            } else {
                valueElement.textContent = 'N/A';
            }
        }
    });
    console.log('Evaluation metrics updated successfully for slide:', slideIndex + 1);
    // 更新 Unconnected Forms 显示
    updateUnconnectedForms(evaluationMetric.unconnected_forms || []);
}

// 更新 Unconnected Forms 显示
function updateUnconnectedForms(unconnectedForms) {
    console.log('Updating unconnected forms with data:', unconnectedForms);
    
    const container = document.getElementById('unconnected-forms-container');
    if (!container) {
        console.warn('Unconnected forms container not found');
        return;
    }
    
    // 清空容器内容
    container.innerHTML = '';
    
    // 如果没有数据，显示无数据消息
    if (!unconnectedForms || unconnectedForms.length === 0) {
        container.innerHTML = '<div class="no-data-message">No unconnected forms data available</div>';
        return;
    }
    
    // 创建表格
    const table = document.createElement('table');
    table.className = 'forms-table';
    
    // 创建表头
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const languageHeader = document.createElement('th');
    languageHeader.textContent = 'Language';
    headerRow.appendChild(languageHeader);
    
    const formHeader = document.createElement('th');
    formHeader.textContent = 'Form';
    headerRow.appendChild(formHeader);
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // 创建表体
    const tbody = document.createElement('tbody');
    
    unconnectedForms.forEach((formData, index) => {
        const row = document.createElement('tr');
        
        // 语言列
        const languageCell = document.createElement('td');
        const languageTag = document.createElement('span');
        languageTag.className = 'language-tag';
        languageTag.textContent = formData.language || 'Unknown';
        languageCell.appendChild(languageTag);
        row.appendChild(languageCell);
        
        // Form列
        const formCell = document.createElement('td');
        formCell.textContent = formData.form || 'N/A';
        row.appendChild(formCell);
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
    
    console.log(`Unconnected forms updated successfully with ${unconnectedForms.length} items`);
}

// Merge Edges 功能
async function mergeEdges() {
    console.log('开始执行 Merge Edges 功能');
    
    // 检查是否有原始Excel数据
    if (!originalExcelData || originalExcelData.length === 0) {
        alert('请先上传Excel文件');
        return;
    }
    
    // 获取当前显示的语义地图数据
    const currentIndex = currentSlideIndex;
    const currentNodes = nodeDatasets[currentIndex];
    const currentEdges = edgeDatasets[currentIndex];
    
    if (!currentNodes || !currentEdges) {
        alert('当前没有可用的语义地图数据');
        return;
    }
    
    // 获取当前显示的地图标题作为map_name
    const currentSlide = document.querySelector('.carousel-slide.active');
    const currentMapName = currentSlide ? currentSlide.querySelector('.graph-title').textContent : `Semantic Map`;
    
    // 构建当前语义地图的数据结构
    const currentGraph = {
        map_name: currentMapName,
        nodes: currentNodes.get().map(node => ({
            id: node.id,
            title: node.title || node.label,
            label: node.label
        })),
        edges: currentEdges.get().map(edge => ({
            id: edge.id,
            from: edge.from,
            to: edge.to,
            label: edge.label || '',
            value: parseFloat(edge.title) || parseFloat(edge.label) || 1.0
        }))
    };
    
    console.log('当前语义地图数据:', currentGraph);
    console.log('原始Excel数据:', originalExcelData);
    
    try {
        // 备份merge前的数据
        const currentIndex = currentSlideIndex;
        backupEvaluationMetricsArray[currentIndex] = evaluationMetricsData[currentIndex] ? JSON.parse(JSON.stringify(evaluationMetricsData[currentIndex])) : null;
        
        // 备份当前的未连接表单数据
        const unconnectedFormsElement = document.getElementById('unconnected-forms');
        if (unconnectedFormsElement) {
            backupUnconnectedFormsArray[currentIndex] = unconnectedFormsElement.innerHTML;
        }
        
        // 显示加载提示
        const originalText = document.getElementById('merge-edge-btn').textContent;
        document.getElementById('merge-edge-btn').textContent = 'Merging...';
        document.getElementById('merge-edge-btn').disabled = true;
        
        // 调用后端merge edges接口
        const response = await fetch('/api/merge-edges', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: originalExcelData.data,
                label: originalExcelData.label,
                graph: currentGraph
            })
        });
        
        if (!response.ok) {
            // 尝试解析后端返回的错误信息
            try {
                const errorData = await response.json();
                if (errorData.error) {
                    console.error(`Merge edges 错误 (${response.status}): ${errorData.error}`);
                    throw new Error(errorData.error);
                }
            } catch (parseError) {
                console.error(`Merge edges 错误: HTTP ${response.status}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }
        
        const result = await response.json();
        console.log('Merge edges 返回结果:', result);
        
        // 处理新增的边数据 - graph_data现在是一个dict包含edges和evaluation_metric
        if (result.graph_data && result.graph_data.edges && Array.isArray(result.graph_data.edges)) {
            const newEdgesData = result.graph_data.edges;
            
            // 将新边添加到当前边数据集中，并设置高亮样式
            const newEdges = newEdgesData.map(edge => {
                const value = parseFloat(edge.value) || 1;
                
                return {
                    id: edge.id,
                    from: edge.from,
                    to: edge.to,
                    label: edge.label || '',
                    title: edge.value ? edge.value.toString() : '',
                    value: value,  // 确保value字段存在
                    color: {
                        color: '#90EE90',  // 浅绿色高亮新添加的边
                        highlight: '#90EE90',
                        hover: '#90EE90'
                    },
                    isNewMergedEdge: true  // 标记为新合并的边
                };
            });
            
            // 添加新边到当前数据集
            edgeDatasets[currentIndex].add(newEdges);
            
            // 更新所有边的宽度（包括新添加的边）
            updateEdgeWidths(currentIndex);
            
            // 存储新边的ID用于后续取消高亮和删除
            window.highlightedMergedEdges = newEdges.map(edge => edge.id);
            mergedEdgeIdsArray[currentIndex] = newEdges.map(edge => edge.id);
            
            // 为网络图添加点击事件监听器，点击画布时取消高亮
            if (networks[currentIndex]) {
                // 移除之前的监听器（如果存在）
                networks[currentIndex].off('click');
                
                // 添加新的点击监听器，保留原有功能并添加取消高亮功能
                networks[currentIndex].on('click', function(params) {
                    // 保留原有的选择功能
                    selectedNodes = params.nodes;
                    selectedEdges = params.edges;
                    currentSlideIndex = currentIndex;
                    
                    // 如果点击的不是边或节点（即点击画布空白处）
                    if (params.nodes.length === 0 && params.edges.length === 0) {
                        // 取消高亮新合并的边
                        if (window.highlightedMergedEdges && window.highlightedMergedEdges.length > 0) {
                            const currentEdges = edgeDatasets[currentIndex].get();
                            const updatedEdges = currentEdges.map(edge => {
                                if (window.highlightedMergedEdges.includes(edge.id)) {
                                    // 恢复为普通边的样式，但保持深粉红色的悬停效果
                                    return {
                                        ...edge,
                                        color: {
                                            color: '#FFCCE5',
                                            highlight: '#FF69B4',
                                            hover: '#FF69B4'
                                        },
                                        isNewMergedEdge: false
                                        // 保持原有的width，不重置为1
                                    };
                                }
                                return edge;
                            });
                            
                            edgeDatasets[currentIndex].update(updatedEdges);
                            window.highlightedMergedEdges = [];
                        }
                    }
                });
                
                // 重新绘制网络图
                networks[currentIndex].redraw();
                networks[currentIndex].fit();
            }
            
            // 更新评价指标数据 - evaluation_metric现在在graph_data中
            if (result.graph_data && result.graph_data.evaluation_metric) {
                evaluationMetricsData[currentIndex] = result.graph_data.evaluation_metric;
                updateEvaluationMetrics(currentIndex, result.graph_data.evaluation_metric);
            }
            
            // 更新forms数据
            if (result.forms_with_nodes) {
                window.currentFormsData = result.forms_with_nodes;
                updateFormFilter(result.forms_with_nodes);
            }
            
            // 更新Unconnected Forms - 使用evaluation_metric中的unconnected_forms字段
            if (result.graph_data && result.graph_data.evaluation_metric && result.graph_data.evaluation_metric.unconnected_forms) {
                updateUnconnectedForms(result.graph_data.evaluation_metric.unconnected_forms);
            } else if (result.forms_with_nodes) {
                // 如果没有unconnected_forms字段，则使用forms_with_nodes作为备选
                updateUnconnectedForms(result.forms_with_nodes);
            }
            
            // 更新按钮状态
            isMergedStates[currentIndex] = true;
            document.getElementById('merge-edge-btn').textContent = 'Restore Merge';
            document.getElementById('merge-edge-btn').disabled = false;
            
            console.log(`Merge edges 完成！已添加 ${newEdgesData.length} 条新边，点击画布空白处可取消高亮。`);
            return; // 成功完成，不执行finally中的按钮恢复
        }
        
    } catch (error) {
        console.error('Merge edges 时出错:', error);
        console.error('Merge edges 失败: ' + error.message);
    } finally {
        // 恢复按钮状态
        document.getElementById('merge-edge-btn').textContent = originalText;
        document.getElementById('merge-edge-btn').disabled = false;
    }
}

// 还原merge操作
function restoreMerge() {
    try {
        const currentIndex = currentSlideIndex;
        
        // 显示加载提示
        document.getElementById('merge-edge-btn').textContent = 'Restoring...';
        document.getElementById('merge-edge-btn').disabled = true;
        
        // 删除所有merge的边
        if (mergedEdgeIdsArray[currentIndex] && mergedEdgeIdsArray[currentIndex].length > 0) {
            edgeDatasets[currentIndex].remove(mergedEdgeIdsArray[currentIndex]);
            
            // 重新绘制网络图
            if (networks[currentIndex]) {
                networks[currentIndex].redraw();
                networks[currentIndex].fit();
            }
        }
        
        // 还原评价指标
        if (backupEvaluationMetricsArray[currentIndex]) {
            evaluationMetricsData[currentIndex] = JSON.parse(JSON.stringify(backupEvaluationMetricsArray[currentIndex]));
            updateEvaluationMetrics(currentIndex, backupEvaluationMetricsArray[currentIndex]);
        }
        
        // 还原未连接表单
        if (backupUnconnectedFormsArray[currentIndex]) {
            const unconnectedFormsElement = document.getElementById('unconnected-forms');
            if (unconnectedFormsElement) {
                unconnectedFormsElement.innerHTML = backupUnconnectedFormsArray[currentIndex];
            }
        }
        
        // 恢复原有的click事件监听器
        if (networks[currentIndex]) {
            networks[currentIndex].off('click');
            networks[currentIndex].on('click', (function(index) {
                return function(params) {
                    selectedNodes = params.nodes;
                    selectedEdges = params.edges;
                    
                    // 更新当前图的索引
                    currentSlideIndex = index;
                };
            })(currentIndex));
        }
        
        // 清理状态
        isMergedStates[currentIndex] = false;
        mergedEdgeIdsArray[currentIndex] = [];
        window.highlightedMergedEdges = [];
        backupEvaluationMetricsArray[currentIndex] = null;
        backupUnconnectedFormsArray[currentIndex] = null;
        
        // 恢复按钮状态
        document.getElementById('merge-edge-btn').textContent = 'Merge Edge';
        document.getElementById('merge-edge-btn').disabled = false;
        
        console.log('Merge操作已还原！');
        
    } catch (error) {
        console.error('还原merge时出错:', error);
        console.error('还原merge失败: ' + error.message);
        
        // 恢复按钮状态
        document.getElementById('merge-edge-btn').textContent = 'Restore Merge';
        document.getElementById('merge-edge-btn').disabled = false;
    }
}

// 更新所有图的标题
function updateGraphTitles(fileName, graphDataArray) {
    // 从文件名中提取基本名称（不包含扩展名）
    const baseName = fileName.replace(/\.[^\.]+$/, '');
    
    // 更新每个图的标题
    const titles = document.querySelectorAll('.graph-title');
    titles.forEach((title, index) => {
        if (graphDataArray && graphDataArray[index] && graphDataArray[index].map_name) {
            title.textContent = `${graphDataArray[index].map_name}: ${baseName}`;
        } else {
            title.textContent = `语义地图 ${index + 1}: ${baseName}`;
        }
    });
}

// 读取Excel文件
function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'array' });
                
                // 获取第一个工作表
                const firstSheetName = workbook.SheetNames[0];
                const firstWorksheet = workbook.Sheets[firstSheetName];
                
                // 将第一个工作表转换为JSON
                const firstSheetData = XLSX.utils.sheet_to_json(firstWorksheet, { defval: null });
                
                // 获取第二个工作表（如果存在）
                let secondSheetData = [];
                if (workbook.SheetNames.length > 1) {
                    const secondSheetName = workbook.SheetNames[1];
                    const secondWorksheet = workbook.Sheets[secondSheetName];
                    secondSheetData = XLSX.utils.sheet_to_json(secondWorksheet, { defval: null });
                }
                
                // 返回包含两个sheet数据的对象
                resolve({
                    data: firstSheetData,
                    label: secondSheetData
                });
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = function(error) {
            reject(error);
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// 发送数据到后端
async function sendDataToBackend(excelData) {
    try {
        const response = await fetch('/api/process-excel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                data: excelData.data,
                label: excelData.label 
            })
        });
        
        if (!response.ok) {
            // Show only ONE alert, without fixed prefix or status code
            let alertMsg = 'Request failed. Please try again later.';
            try {
                const errorData = await response.json();
                if (errorData && typeof errorData.error === 'string' && errorData.error.trim()) {
                    alertMsg = errorData.error.trim();
                }
            } catch (parseError) {
                // Ignore parse error, keep generic message
            }
            alert(alertMsg);
            throw new Error(alertMsg);
        }
        
        return await response.json();
    } catch (error) {
        console.error('发送数据到后端时出错:', error);
        
        // Network/connection errors: show ONE English alert
        if (error.message && error.message.includes('fetch')) {
            alert('Unable to connect to backend server. Request failed');
        }
        
        // Re-throw so caller can handle without duplicating alerts
        throw error;
    }
}



// 更新图形
function updateGraph(graphDataArray) {
    console.log('开始更新图形，接收到的数据:', graphDataArray);
    console.log('语义地图数量:', graphDataArray.length);
    
    // 清除现有的网络图实例
    for (let i = 0; i < networks.length; i++) {
        if (networks[i]) {
            networks[i].destroy();
            networks[i] = null;
        }
    }
    
    // 清空数组
    networks = [];
    nodeDatasets = [];
    edgeDatasets = [];
    evaluationMetricsData = [];
    
    // 初始化merge相关的状态数组
    isMergedStates = [];
    backupEvaluationMetricsArray = [];
    backupUnconnectedFormsArray = [];
    mergedEdgeIdsArray = [];
    
    // 为每个地图初始化merge状态
    for (let i = 0; i < graphDataArray.length; i++) {
        isMergedStates[i] = false;
        backupEvaluationMetricsArray[i] = null;
        backupUnconnectedFormsArray[i] = null;
        mergedEdgeIdsArray[i] = [];
    }
    
    // 动态创建轮播图幻灯片和指示器
    createCarouselSlides(graphDataArray.length);
    
    // 根据返回的数据创建对应数量的网络图
    for (let i = 0; i < graphDataArray.length; i++) {
        const graphData = graphDataArray[i];
        
        // 确保数据格式正确
        const nodes = graphData.nodes || [];
        const edges = (graphData.edges || []).map(edge => {
            // 确保每条边都有label属性
            if (!edge.hasOwnProperty('label') && edge.value !== undefined) {
                edge.label = edge.value.toString();
            }
            // 确保每条边都有width属性
            if (!edge.hasOwnProperty('width') && edge.value !== undefined) {
                const value = parseFloat(edge.value) || 1;
                edge.width = Math.max(1, Math.min(10, value * 2));
            }
            return edge;
        });
        
        console.log(`处理第${i+1}个语义地图:`, graphData.map_name || `地图${i+1}`);
        console.log(`节点数量: ${nodes.length}, 边数量: ${edges.length}`);
        
        // 存储评价指标数据
        evaluationMetricsData[i] = graphData.evaluation_metric || null;
        
        nodeDatasets[i] = new vis.DataSet(nodes);
        edgeDatasets[i] = new vis.DataSet(edges);
        
        // 获取容器
        const container = document.getElementById(`graph-container-${i+1}`);
        
        // 创建数据对象
        const data = {
            nodes: nodeDatasets[i],
            edges: edgeDatasets[i]
        };
        
        // 为第一个图创建优化配置，减少性能负担
        let networkOptions = options;
        if (i === 0) {
            networkOptions = {
                ...options,
                physics: {
                    enabled: true,
                    stabilization: {
                        enabled: true,
                        iterations: 100,
                        updateInterval: 25
                    },
                    barnesHut: {
                        gravitationalConstant: -1000,
                        centralGravity: 0.1,
                        springLength: 100,
                        springConstant: 0.02
                    }
                }
            };
        }
        
        // 创建网络图
        networks[i] = new vis.Network(container, data, networkOptions);
        
        // 添加选择事件监听
        networks[i].on('click', (function(index) {
            return function(params) {
                selectedNodes = params.nodes;
                selectedEdges = params.edges;
                
                // 更新当前图的索引
                currentSlideIndex = index;
            };
        })(i));
        
        // 更新评价指标
        updateEvaluationMetrics(i, graphData.evaluation_metric);
        
        // 重新绘制网络图
        networks[i].redraw();
        // 只在数据更新后调用一次fit，避免重复调用影响性能
        if (i === 0) {
            // 对第一个图使用更快的fit，避免卡顿
            setTimeout(() => {
                networks[i].fit();
            }, 100);
        } else {
            // 对其他图延迟调用fit
            setTimeout(() => {
                networks[i].fit();
            }, 200 + i * 100);
        }
    }
    
    // 更新总幻灯片数量
    totalSlides = graphDataArray.length;
    
    // 显示第一个轮播图
    showSlide(0);
}

// 更新轮播图指示器
function updateCarouselIndicators(count) {
    const indicatorsContainer = document.querySelector('.carousel-indicators');
    indicatorsContainer.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
        const indicator = document.createElement('span');
        indicator.className = i === 0 ? 'indicator active' : 'indicator';
        indicator.setAttribute('data-index', i);
        indicator.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            showSlide(index);
        });
        indicatorsContainer.appendChild(indicator);
    }
}



// 显示添加边表单
function showAddEdgeForm() {
    // 更新节点选择器
    updateNodeSelectors();
    
    // 如果当前地图的节点数量不足，显示提示
    const currentNodes = nodeDatasets[currentSlideIndex].get();
    if (currentNodes.length < 2) {
        alert('需要至少两个节点才能添加边');
        return;
    }
    
    document.getElementById('edge-form').style.display = 'block';
}

// 更新节点选择器
function updateNodeSelectors() {
    const fromSelect = document.getElementById('from-node');
    const toSelect = document.getElementById('to-node');
    
    // 清空现有选项
    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';
    
    // 添加当前地图的节点选项
    nodeDatasets[currentSlideIndex].forEach(node => {
        const fromOption = document.createElement('option');
        fromOption.value = node.id;
        fromOption.textContent = node.label;
        fromSelect.appendChild(fromOption);
        
        const toOption = document.createElement('option');
        toOption.value = node.id;
        toOption.textContent = node.label;
        toSelect.appendChild(toOption);
    });
}

// 隐藏添加边表单
function hideAddEdgeForm() {
    document.getElementById('edge-form').style.display = 'none';
    document.getElementById('edge-label').value = '';
}

// 添加新边
async function addEdge() {
    const fromNode = document.getElementById('from-node').value;
    const toNode = document.getElementById('to-node').value;
    const label = document.getElementById('edge-label').value.trim();
    
    if (fromNode && toNode) {
        // 检查是否已存在相同的边（只在当前地图中检查）
        const existingEdges = edgeDatasets[currentSlideIndex].get({
            filter: function(edge) {
                return edge.from === fromNode && edge.to === toNode;
            }
        });
        
        if (existingEdges.length > 0) {
            alert('这两个节点之间已经存在边');
            return;
        }
        
        // 解析边的值（权重）
        const value = parseFloat(label) || 1;
        
        const newEdge = {
            id: `e${Date.now()}`,
            from: fromNode,
            to: toNode,
            label: label,
            value: value,
            arrows: { to: { enabled: false } },
            color: {
                color: '#FFCCE5',       // 浅粉色
                highlight: '#FF69B4',   // 深粉色
                hover: '#FF69B4'        // 鼠标悬停时显示深粉色
            }
        };
        
        // 只在当前地图上添加边
        edgeDatasets[currentSlideIndex].add(newEdge);
        hideAddEdgeForm();
        
        // Only redraw current map
        if (networks[currentSlideIndex]) {
            networks[currentSlideIndex].redraw();
        }
        
        // 更新当前地图边的宽度
        updateEdgeWidths(currentSlideIndex);
        
        // 调用后端接口进行校验
        await validateGraphWithBackend();
    }
}



// 删除选中的边
async function deleteSelectedEdge() {
    if (selectedEdges.length > 0) {
        // 确认删除
        if (confirm(`确定要删除选中的 ${selectedEdges.length} 条边吗？`)) {
            // 只从当前地图中删除边
            edgeDatasets[currentSlideIndex].remove(selectedEdges);
            selectedEdges = [];
            
            // 只重新绘制当前地图
            if (networks[currentSlideIndex]) {
                networks[currentSlideIndex].redraw();
            }
            
            // 调用后端接口进行校验
            await validateGraphWithBackend();
        }
    } else {
        alert('请先选择要删除的边');
    }
}

// 显示修改边表单
function showEditEdgeForm() {
    if (selectedEdges.length !== 1) {
        alert('请先选择一条要修改的边');
        return;
    }
    
    // 获取选中的边（从当前地图的数据集中获取）
    const edgeId = selectedEdges[0];
    const edge = edgeDatasets[currentSlideIndex].get(edgeId);
    
    if (!edge) {
        alert('无法获取选中的边');
        return;
    }
    
    // 设置当前正在编辑的边ID
    currentEditEdgeId = edgeId;
    
    // Show edit edge form
    document.getElementById('edit-edge-form').style.display = 'block';
    document.getElementById('edge-form').style.display = 'none';
    
    // 设置表单初始值
    document.getElementById('edit-edge-label').value = edge.label || '';
    document.getElementById('edit-edge-label').focus();
}

// 隐藏修改边表单
function hideEditEdgeForm() {
    document.getElementById('edit-edge-form').style.display = 'none';
    document.getElementById('edit-edge-label').value = '';
    currentEditEdgeId = null;
}

// 更新边
async function updateEdge() {
    if (currentEditEdgeId === null) {
        alert('没有选择要修改的边');
        return;
    }
    
    const newLabel = document.getElementById('edit-edge-label').value.trim();
    
    // Parse edge value (weight)
    const value = parseFloat(newLabel) || 1;
    
    // 获取当前边的信息（从当前地图的数据集中获取）
    const edge = edgeDatasets[currentSlideIndex].get(currentEditEdgeId);
    
    // 只更新当前地图的边
    edgeDatasets[currentSlideIndex].update({
        id: currentEditEdgeId,
        from: edge.from,
        to: edge.to,
        label: newLabel,
        title: newLabel,
        value: value,
        arrows: { to: { enabled: false } },
        color: {
            color: '#FFCCE5',       // 浅粉色
            highlight: '#FF69B4',   // 深粉色
            hover: '#FF69B4'        // 鼠标悬停时显示深粉色
        }
    });
    
    // 隐藏表单
    hideEditEdgeForm();
    
    // Only redraw current map
    if (networks[currentSlideIndex]) {
        networks[currentSlideIndex].redraw();
    }
    
    // 只更新当前地图边的宽度
    updateEdgeWidths(currentSlideIndex);
    
    // 调用后端接口进行校验
    await validateGraphWithBackend();
}

// 将当前显示的网络图居中
function centerGraph() {
    // 获取当前显示的网络图实例
    const network = networks[currentSlideIndex];
    
    if (network) {
        // 使用fit()方法将视图调整到适合所有节点的大小
        network.fit({
            animation: {
                duration: 1000,
                easingFunction: 'easeInOutQuad'
            }
        });
    }
}

// 美化图形布局 / 恢复原始布局
function beautifyGraph() {
    const beautifyBtn = document.getElementById('beautiful-btn');
    
    // 检查是否有网络图实例
    if (networks.length > 0) {
        if (!isBeautified) {
            // 执行美化操作
            console.log('开始美化所有图形布局');
            
            // 创建美化的配置选项
            const beautifyOptions = {
                edges: {
                    smooth: {
                        enabled: false  // 禁用平滑曲线，使边变成直线
                    }
                },
                physics: {
                    enabled: false  // 禁用物理引擎，固定节点位置
                },
                layout: {
                    improvedLayout: true,
                    clusterThreshold: 150
                },
                interaction: {
                    dragNodes: true,  // 允许拖拽节点
                    dragView: true,   // 允许拖拽视图
                    zoomView: true    // 允许缩放视图
                }
            };
            
            // 对所有网络图实例应用美化配置
            networks.forEach((network, index) => {
                if (network) {
                    // 应用美化配置
                    network.setOptions(beautifyOptions);
                    
                    console.log(`图形 ${index + 1} 美化布局完成 - 节点位置已固定`);
                    
                    // 调整视图
                    network.fit({
                        animation: {
                            duration: 1000,
                            easingFunction: 'easeInOutQuad'
                        }
                    });
                }
            });
            
            console.log('所有图形美化布局完成 - 拖拽时其他节点将保持固定位置');
            
            // 更新状态和按钮文本
            isBeautified = true;
            beautifyBtn.textContent = 'Restore';
            
        } else {
            // 执行恢复操作
            console.log('恢复所有原始图形布局');
            
            // 创建恢复的配置选项（恢复到原始的物理引擎设置）
            const restoreOptions = {
                edges: {
                    smooth: {
                        enabled: true,  // 启用平滑曲线，允许边弯曲
                        type: 'dynamic',
                        roundness: 0.5
                    }
                },
                physics: {
                    enabled: true,
                    solver: 'barnesHut',  // 恢复到原始的barnesHut算法
                    barnesHut: {
                        gravitationalConstant: -2000,
                        centralGravity: 0.3,
                        springLength: 150,
                        springConstant: 0.04
                    },
                    stabilization: {
                        enabled: true,
                        iterations: 1000,
                        updateInterval: 25
                    }
                },
                layout: {
                    improvedLayout: false
                },
                interaction: {
                    dragNodes: true,  // 允许拖拽节点
                    dragView: true,   // 允许拖拽视图
                    zoomView: true    // 允许缩放视图
                }
            };
            
            // 对所有网络图实例应用恢复配置
            let completedCount = 0;
            networks.forEach((network, index) => {
                if (network) {
                    // 应用恢复配置
                    network.setOptions(restoreOptions);
                    
                    // 重新稳定化网络
                    network.stabilize();
                    
                    // 稳定化完成后调整视图
                    network.once('stabilizationIterationsDone', function() {
                        completedCount++;
                        console.log(`图形 ${index + 1} 恢复布局完成`);
                        
                        // 调整视图
                        network.fit({
                            animation: {
                                duration: 1500,
                                easingFunction: 'easeInOutQuad'
                            }
                        });
                        
                        // 当所有网络都完成恢复时
                        if (completedCount === networks.length) {
                            console.log('所有图形恢复布局完成');
                        }
                    });
                }
            });
            
            // 更新状态和按钮文本
            isBeautified = false;
            beautifyBtn.textContent = 'Beautify';
        }
    }
}

// 下载图形为图片
function downloadGraph() {
    // 获取当前显示的图形容器
    const currentSlide = document.querySelector('.carousel-slide.active');
    const graphTitle = currentSlide.querySelector('.graph-title').textContent;
    const container = currentSlide.querySelector('.graph-container');
    
    // 添加下载状态类来隐藏控制按钮
    container.classList.add('downloading');
    
    // 等待CSS过渡完成后再截图
    setTimeout(() => {
        // 使用html2canvas将容器转换为canvas
        html2canvas(container, {
            ignoreElements: function(element) {
                // 忽略包含vis-相关类名的元素
                return element.className && (
                    element.className.includes('vis-navigation') ||
                    element.className.includes('vis-manipulation') ||
                    element.className.includes('vis-button')
                );
            },
            useCORS: true,
            allowTaint: true,
            scale: 2 // 提高图片质量
        }).then(canvas => {
            // 移除下载状态类，恢复按钮显示
            container.classList.remove('downloading');
            
            // 创建下载链接
            const link = document.createElement('a');
            link.download = graphTitle + '_' + new Date().toISOString().slice(0, 10) + '.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(error => {
            // 如果出错，也要移除下载状态类
            container.classList.remove('downloading');
            console.error('下载图片时出错:', error);
        });
    }, 350); // 等待CSS过渡完成
}

// 调用后端接口校验语义地图质量
async function validateGraphWithBackend() {
    try {
        // 检查是否有原始Excel数据
        if (!originalExcelData || originalExcelData.length === 0) {
            console.warn('没有原始Excel数据，无法进行校验');
            return;
        }
        
        // 构建当前地图的图数据
        const currentNodes = nodeDatasets[currentSlideIndex].get();
        const currentEdges = edgeDatasets[currentSlideIndex].get();
        
        // 获取当前地图的名称
        const currentSlide = document.querySelector('.carousel-slide.active');
        const mapName = currentSlide ? currentSlide.querySelector('.graph-title').textContent : `Semantic Map`;
        
        const graphData = {
            nodes: currentNodes,
            edges: currentEdges,
            map_name: mapName
        };
        
        // 调用后端接口
        const response = await fetch('/api/edge-modify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: originalExcelData.data,
                label: originalExcelData.label,
                graph: graphData
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const evaluationResult = await response.json();
        
        // 更新评价指标数据
        evaluationMetricsData[currentSlideIndex] = evaluationResult;
        
        // 更新评价指标显示
        updateEvaluationMetrics(currentSlideIndex, evaluationResult);
        
        console.log('语义地图校验完成，评价指标已更新');
        
    } catch (error) {
        console.error('调用后端校验接口时出错:', error);
        // 可以选择显示错误提示，但不阻断用户操作
        // alert('校验失败: ' + error.message);
    }
}

// 更新指定地图的边宽度
function updateEdgeWidths(mapIndex) {
    // 如果未指定地图索引，则使用当前显示的地图
    const index = (mapIndex !== undefined) ? mapIndex : currentSlideIndex;
    
    // 获取指定地图的所有边
    const allEdges = edgeDatasets[index].get();
    
    if (allEdges.length === 0) {
        return; // 没有边，不需要更新
    }
    
    // 找出最大和最小值
    let minValue = Infinity;
    let maxValue = -Infinity;
    
    allEdges.forEach(edge => {
        const value = parseFloat(edge.value) || 1;
        if (value < minValue) minValue = value;
        if (value > maxValue) maxValue = value;
    });
    
    // 如果最大值等于最小值，所有边使用相同宽度
    if (maxValue === minValue) {
        allEdges.forEach(edge => {
            edgeDatasets[index].update({
                id: edge.id,
                width: 5 // 中间宽度
            });
        });
        
        // 只重新绘制指定地图
        if (networks[index]) {
            networks[index].redraw();
        }
        
        return;
    }
    
    // 设置边的宽度范围
    const minWidth = 1;  // 最小宽度
    const maxWidth = 10; // 最大宽度
    
    // 更新每条边的宽度
    allEdges.forEach(edge => {
        const value = parseFloat(edge.value) || 1;
        
        // 计算宽度（线性映射）
        const width = minWidth + ((value - minValue) / (maxValue - minValue)) * (maxWidth - minWidth);
        
        // Update edge width
        edgeDatasets[index].update({
            id: edge.id,
            width: width
        });
    });
    
    // 只重新绘制指定地图
    if (networks[index]) {
        networks[index].redraw();
    }
}

// Help模态框功能（支持中/英切换）
async function showHelpModal() {
    const modal = document.getElementById('help-modal');
    const helpContent = document.getElementById('help-content');
    const contentWrap = document.querySelector('#help-modal .modal-content');

    // 动态创建语言切换按钮（仅创建一次）
    if (!document.getElementById('help-lang-switch')) {
        const switchBar = document.createElement('div');
        switchBar.id = 'help-lang-switch';
        switchBar.style.display = 'flex';
        switchBar.style.justifyContent = 'flex-start';
        // 小尺寸样式
        const btnZh = document.createElement('button');
        btnZh.id = 'help-lang-zh';
        btnZh.textContent = '中文';
        btnZh.style.fontSize = '12px';
        btnZh.style.padding = '4px 8px';
        btnZh.style.lineHeight = '1';
        btnZh.style.borderRadius = '4px';
        const btnEn = document.createElement('button');
        btnEn.id = 'help-lang-en';
        btnEn.textContent = 'English';
        btnEn.style.fontSize = '12px';
        btnEn.style.padding = '4px 8px';
        btnEn.style.lineHeight = '1';
        btnEn.style.borderRadius = '4px';

        switchBar.appendChild(btnZh);
        switchBar.appendChild(btnEn);
        contentWrap.insertBefore(switchBar, helpContent);

        btnZh.addEventListener('click', async () => {
            localStorage.setItem('helpLanguage', 'zh');
            await renderHelp();
        });
        btnEn.addEventListener('click', async () => {
            localStorage.setItem('helpLanguage', 'en');
            await renderHelp();
        });
    }

    async function renderHelp() {
        const lang = localStorage.getItem('helpLanguage') || (navigator.language && navigator.language.startsWith('zh') ? 'zh' : 'en');
        try {
            const pathBase = lang === 'zh' ? 'front/chinese_description.md' : 'front/english_description.md';
            const response = await fetch(`${pathBase}?t=${Date.now()}`);
            if (!response.ok) {
                throw new Error(`Failed to load help file: ${response.status}`);
            }
            const markdownText = await response.text();

            // 使用原有的 markdown 转 HTML
            const htmlContent = convertMarkdownToHTML(markdownText);
            helpContent.innerHTML = htmlContent;

            // 按钮状态反馈
            const btnZh = document.getElementById('help-lang-zh');
            const btnEn = document.getElementById('help-lang-en');
            if (btnZh && btnEn) {
                btnZh.disabled = (lang === 'zh');
                btnEn.disabled = (lang === 'en');
            }
        } catch (error) {
            console.error('加载帮助文件失败:', error);
            helpContent.innerHTML = '<p>无法加载帮助文档，请稍后重试。</p>';
        }
    }

    // 初次渲染并显示模态框
    await renderHelp();
    modal.style.display = 'block';
}

// 改进的markdown转HTML函数
function convertMarkdownToHTML(markdown) {
    // 按行分割处理
    const lines = markdown.split('\n');
    const result = [];
    let inList = false;
    let currentParagraph = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 空行处理
        if (line === '') {
            if (inList) {
                result.push('</ul>');
                inList = false;
            }
            if (currentParagraph.length > 0) {
                result.push('<p>' + currentParagraph.join('<br>') + '</p>');
                currentParagraph = [];
            }
            continue;
        }
        
        // 标题处理
        if (line.match(/^#{1,5} /)) {
            if (inList) {
                result.push('</ul>');
                inList = false;
            }
            if (currentParagraph.length > 0) {
                result.push('<p>' + currentParagraph.join('<br>') + '</p>');
                currentParagraph = [];
            }
            
            const level = line.match(/^#+/)[0].length;
            const text = line.replace(/^#+\s*/, '');
            result.push(`<h${level}>${text}</h${level}>`);
            continue;
        }
        
        // 列表项处理
        if (line.match(/^- /)) {
            if (currentParagraph.length > 0) {
                result.push('<p>' + currentParagraph.join('<br>') + '</p>');
                currentParagraph = [];
            }
            if (!inList) {
                result.push('<ul>');
                inList = true;
            }
            const text = line.replace(/^- /, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            result.push(`<li>${text}</li>`);
            continue;
        }
        
        // 普通文本处理
        if (inList) {
            result.push('</ul>');
            inList = false;
        }
        
        // 处理粗体
        const processedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        currentParagraph.push(processedLine);
    }
    
    // 处理最后的内容
    if (inList) {
        result.push('</ul>');
    }
    if (currentParagraph.length > 0) {
        result.push('<p>' + currentParagraph.join('<br>') + '</p>');
    }
    
    return result.join('\n');
}

// 模态框关闭功能
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('help-modal');
    const closeBtn = document.querySelector('.close');
    
    // 点击关闭按钮关闭模态框
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
    }
    
    // 点击模态框外部关闭
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});