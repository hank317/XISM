# XISM: X-Interactive Semantic Map
XISM是一款基于Web的语义地图生成工具，允许用户上传Excel表格数据，生成交互式图形，并支持实时编辑和导出图片。

## 特性总览
- 上传Excel表格生成地图
- 地图动态编辑
- 交互式图形界面
- 评价地图质量
- 导出地图为PNG图片

## 操作指南
### Upload Excel File
在Upload Excel File模块中，点击选择文件按钮，上传对应的Excel文件。再点击右侧的upload and generate graph按钮，即可完成文件上传。
#### Excel格式要求
Excel格式不符合要求，可能会解析失败，请按照要求上传！！！
##### 数据表
数据表必须放在Excel的第一个sheet，用于自动化生成语义地图：
- 数据表需要使用languages、forms作为表格的前两列名，languages列的值可以缺省，但是forms的值必须填充；
- 表格至少包含两个概念（即语义单元）；
- 表格至少包含一个form。
- 仅需标记为1的位置即可。
##### 真值（optional）
真值表放在Excel的第二个sheet，用于评估生成的语义地图与人工标注的差异：
- 真值表的列名和行名需要相同，且和数据表中的概念顺序保持一致；
- 仅需标记为1的位置即可。

### Examples
我们提供了三个样例，用户可以直接使用，点击ex按钮即可自动生成对应的语义地图。
- ex.1："Eating" related words
- ex.2：Adverb
- ex.3：Double transitive construction

### Graph Controls
在Graph Controls模块中，设置了多个功能按钮，以实现人机交互：
#### 边的操作
- add edge：用户点击该功能按钮，从下拉单中选择两个语义节点，并指定权重，即可新增边；
- edit edge：用户单击地图中的某个边后，点击该功能按钮，设置新的权重，即可编辑边；
- delete edge：用户单击地图中的某个边后，点击该功能按钮，即可删除边；
- merge edge：用户点击该功能按钮，系统将自动化自底向上添加边，以实现全form连通，将Recall提升到1。
#### 美化操作
- center：用户点击该功能按钮，语义地图会聚集在画布中央，便于观察全貌；
- beautify：用户点击该功能按钮，系统重新渲染语义地图，支持更灵活的自定义布局。
#### 地图下载
- download image：用户点击该功能按钮，根据当前画布中展示的语义地图，导出高清png图片。
#### form过滤
- 用户点击该功能按钮，从下拉单中选择需要观察的form，语义地图中该form对应的语义节点会自动高亮，用户观察连通性。

### Evaluation Metrics
地图评估重要包含以下7个指标：
- Accuracy
- Precision
- Recall
- F1 Score
- Weight Sum
- Degree Mean
- Degree Std

### Unconnected Forms
该模块用于展示当前语义地图中未连通的form，会随着对语义地图的编辑实时更新，便于用户判断子图连通性。


