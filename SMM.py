import numpy as np
import networkx as nx
import copy
import time

from collections import Counter
from itertools import combinations


class SemanticMap(object):

    def __init__(self, tfM, featNames, formNames, adjM=None, GT_adj=None, zeroOcc=0, calc_type='G'):
        # form-feature matrix    np.array  (N, D)
        self.tfM = tfM
        # feature map    dict(int: str)
        self.origin_featNames = featNames
        # deduplicated feature list
        self.unique_featNames = []
        # form list
        self.formNames = formNames
        # the ground truth adjacency matrix
        self.GT_adj = GT_adj
        # scale the weights
        self.zeroOcc = zeroOcc
        # calculation method
        self.calc_type = calc_type
        # fully connected adjacency matrix
        self.adjM = adjM
        # graph corresponding to the fully connected adjacency matrix
        self.G = None
        # candidate tree list
        self.trees = []
        # record deduplication information    list
        self.merge_feat_info = []
        # feature deduplication
        self.merge_feat()
        


    def merge_feat(self):
        """
        merge the feature columns if they are totally the same.
        """
        unique_featNames = []
        unique_columns = []
        for i, col in enumerate(self.tfM.T.tolist()):
            if col not in unique_columns or sum(col) == 0:
                unique_columns.append(col)
                unique_featNames.append(self.origin_featNames[i])
            else:
                ix = unique_columns.index(col)
                unique_featNames[ix] += "/" + self.origin_featNames[i]
                self.merge_feat_info.append((ix, i)) #  the i-th feature is merged into the ix-th feature.

        # update form-feature matrix
        self.tfM = np.stack(unique_columns, axis=1)
        # update deduplicated feature list
        self.unique_featNames = unique_featNames



    def add_node(self, adj_matrix, original_index, insert_index):
        """
        在邻接矩阵中添加一个新节点，该节点与指定节点具有相同的邻接关系，并与指定节点相连

        参数:
        adj_matrix (np.ndarray): 原始邻接矩阵 (n x n)
        original_index (int): 要复制的原始节点索引 (0-based)
        insert_index (int): 新节点要插入的位置索引 (0-based)

        返回:
        np.ndarray: 新的邻接矩阵 ((n+1) x (n+1))
        """
        n = adj_matrix.shape[0]

        # 创建新的 (n+1) x (n+1) 矩阵
        new_adj_matrix = np.zeros((n + 1, n + 1), dtype=adj_matrix.dtype)

        # 复制原始矩阵数据（跳过插入位置）
        # 上半部分（插入位置之前）
        new_adj_matrix[:insert_index, :insert_index] = adj_matrix[:insert_index, :insert_index]
        new_adj_matrix[:insert_index, insert_index + 1:] = adj_matrix[:insert_index, insert_index:]

        # 下半部分（插入位置之后）
        new_adj_matrix[insert_index + 1:, :insert_index] = adj_matrix[insert_index:, :insert_index]
        new_adj_matrix[insert_index + 1:, insert_index + 1:] = adj_matrix[insert_index:, insert_index:]

        # 确定原始节点在新矩阵中的位置
        pos_old = original_index if original_index < insert_index else original_index + 1

        # 复制原始节点的邻接关系到新节点
        # 处理插入位置之前的列
        if insert_index > 0:
            new_adj_matrix[insert_index, :insert_index] = adj_matrix[original_index, :insert_index]
            new_adj_matrix[:insert_index, insert_index] = adj_matrix[original_index, :insert_index]

        # 处理插入位置之后的列
        if insert_index < n:
            new_adj_matrix[insert_index, insert_index + 1:] = adj_matrix[original_index, insert_index:]
            new_adj_matrix[insert_index + 1:, insert_index] = adj_matrix[original_index, insert_index:]

        # 设置新节点与原始节点之间的邻接关系为1
        new_adj_matrix[insert_index, pos_old] = 1
        new_adj_matrix[pos_old, insert_index] = 1

        return new_adj_matrix



    def update_record(self, record, insert_index):
        """
        update the record of merged feature columns
        """
        for original_index, new_original_index in record.items():
            if new_original_index >= insert_index:
                record[original_index] = new_original_index + 1
        return record



    def get_unmerged_matrix(self, adj_matrix):
        """
        restore the merged feature columns to maintain consistency with the features in the form-feature matrix
        """
        record = dict()
        for i in range(adj_matrix.shape[0]):
            record[i] = i
        for original_index, insert_index in self.merge_feat_info:
            new_original_index = record[original_index]
            adj_matrix = self.add_node(adj_matrix, new_original_index, insert_index)
            record = self.update_record(record, insert_index)
        return adj_matrix



    def calculate_semantic_relations(self, matrix: np.ndarray,
                                     calc_type: str = 'G') -> np.ndarray:
        """
        compute the weights in the adjacency matrix
        """
        # input validation
        if not isinstance(matrix, np.ndarray):
            raise ValueError("the input must be a NumPy array")

        if matrix.ndim != 2:
            raise ValueError("the input must be a 2D array")

        if calc_type not in ['G', 'J', 'D']:
            raise ValueError("the computation type must be 'G', 'J', or 'D'")

        n_forms, n_features = matrix.shape

        # compute the occurrence frequency of each semantic feature
        feature_freq = np.sum(matrix, axis=0)  # 形状: (n_features,)

        # initialize the adjacency matrix
        adj_matrix = np.zeros((n_features, n_features))

        if calc_type == 'G':
            # Co-occurrence frequency = matrix transpose multiplied by the matrix
            adj_matrix = matrix.T @ matrix * (1-self.zeroOcc) + (1 - matrix).T @ (1 - matrix) * self.zeroOcc

        elif calc_type == 'J':
            # Jaccard similarity = |Intersection| / |Union|
            # |Intersection| = co-occurrence frequency
            # |Union| = freq(A) + freq(B) - co-occurrence frequency
            cooccurrence = matrix.T @ matrix
            for i in range(n_features):
                for j in range(n_features):
                    if i == j:
                        adj_matrix[i, j] = 0.0
                    else:
                        union = feature_freq[i] + feature_freq[j] - cooccurrence[i, j]
                        if union > 0:
                            adj_matrix[i, j] = 0.1*cooccurrence[i, j] / union + cooccurrence[i, j]*0.9
                        else:
                            adj_matrix[i, j] = 0.0

        elif calc_type == 'D':
            # Dice coefficient = 2 * |Intersection| / (|A| + |B|)
            cooccurrence = matrix.T @ matrix

            for i in range(n_features):
                for j in range(n_features):
                    if i == j:
                        adj_matrix[i, j] = 0.0
                    else:
                        total = feature_freq[i] + feature_freq[j]
                        if total > 0:
                            adj_matrix[i, j] = 2 * cooccurrence[i, j] / total
                        else:
                            adj_matrix[i, j] = 0.0

        return adj_matrix



    def connected_graph(self):
        """
        To construct an undirected acyclic (fully connected) graph according to a term-feature matrix
        """

        if not self.adjM:
            adj_matrix = self.calculate_semantic_relations(self.tfM, self.calc_type)
            self.adjM = np.triu(adj_matrix) # get the upper triangular matrix

        # set the diagonal of the matrix to zero
        np.fill_diagonal(self.adjM, val=0)
        self.G = nx.from_numpy_array(self.adjM)



    def get_optimal_SpanningTrees(self):
        """
        To get all the spanning trees given a graph. The trees should be ordered according to its sum of weights.
        """

        self.connected_graph()

        # trees = nx.algorithms.tree.mst.SpanningTreeIterator(self.G, minimum=False)
        start_trees = time.time()
        trees = nx.algorithms.tree.SpanningTreeIterator(self.G, minimum=False)
        end_trees = time.time()
        print("trees time: ", (end_trees - start_trees)*1000)
        start_num = time.time()
        number_trees = nx.algorithms.tree.number_of_spanning_trees(self.G)
        end_num = time.time()
        print("Spanning Trees: ", number_trees, (end_num-start_num)*1000)

        max_weight = 0
        start_std = time.time()
        for index, tree in enumerate(trees):
            # compute the sum of all edge weights
            total_weight = sum(d['weight'] for u, v, d in tree.edges(data=True))
            # the number of edges connected to each node.
            deg = [d for _, d in tree.degree()]
            deg_std = np.std(deg)
            if index == 0:
                max_weight = total_weight
            if total_weight < max_weight or index >= 6000:
                print(index)
                break
            self.trees.append((tree, deg_std))
        end_std = time.time()
        print("std time: ", (end_std - start_std)*1000)
        start_sort = time.time()
        self.trees = sorted(self.trees, key=lambda x: x[1], reverse=False) ## 修改这里！！！ 效率问题 别带着tree进行排序
        end_sort = time.time()
        print("sort time: ", (end_sort - start_sort)*1000)

        start_sample = time.time()
        # perform random sampling to enhance the diversity of candidate trees
        if len(self.trees) > 5:
            new_trees= []
            # always include the first one, which by default is the optimal tree
            new_trees.append(self.trees[0])
            all_selected_index = np.linspace(1, len(self.trees)-2, 3, dtype=int)
            for selected_index in all_selected_index:
                new_trees.append(self.trees[selected_index])
            # retain the worst-performing tree
            new_trees.append(self.trees[-1])
            self.trees = new_trees

        # self.trees = self.trees[:5]
        self.trees = [item[0] for item in self.trees]
        end_sample = time.time()
        print("sample time: ", (end_sample-start_sample)*1000)



    def get_poss_subgraph(self, graph, max_size=5):
        """
        Find all possible connected subgraphs in the current graph.
        :param graph: current graph
        :return: list of connected subgraphs
        """
        nodes = list(graph.nodes)
        poss_subG_list = []

        for r in range(2, max_size):
            for node_combination in combinations(nodes, r):
                sub_graph = graph.subgraph(node_combination)
                if nx.is_connected(sub_graph):
                    poss_subG_list.append(sub_graph)
        return poss_subG_list



    def norm_matrix(self, matrix):
        # 确保输入是方阵
        assert matrix.shape[0] == matrix.shape[1], "Input matrix must be square"
        # 将下三角的数据累加到上三角
        result = np.triu(matrix, 1) + np.tril(matrix, -1).T
        result = result + result.T
        return result



    def evaluate_against_gt(self, pre_matrix):
        """
        Evaluate accuracy, precision, recall, and F1 score against the ground truth
        :param pre_matrix: predicted adjacency matrix
        :return: accuracy, precision, recall, and F1 score
        """
        try:
            if self.GT_adj is None:
                return None

            pre_matrix = self.get_unmerged_matrix(pre_matrix)
            pre_matrix = self.norm_matrix(pre_matrix)
            gt_matrix = self.norm_matrix(self.GT_adj)
            # gt_matrix = self.norm_matrix(gt_matrix)
            acc = np.sum((pre_matrix!=0) == (gt_matrix!=0)) / (gt_matrix.shape[0] ** 2)

            true_edges = (gt_matrix != 0)
            pred_edges = (pre_matrix != 0)

            # tp: predicted edge exists and ground truth edge exists
            tp = np.sum(true_edges & pred_edges)
            # fp: predicted edge exists but ground truth edge does not exist
            fp = np.sum(~true_edges & pred_edges)
            # fn: ground truth edge exists but predicted edge does not exist
            fn = np.sum(true_edges & ~pred_edges)
            # tn: ground truth edge does not exist and predicted edge does not exist
            # tn = np.sum(~true_edges & ~pred_edges)

            precision = tp / (tp + fp) if (tp + fp) > 0 else 0
            recall = tp / (fn + tp) if (fn + tp) > 0 else 0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

            return {"acc": acc, "precision": precision, "recall": recall, "f1": f1}
        except Exception as e:
            print(e)
            return {}



    def find_cycles_networkx(self, nx_graph):
        """
        使用NetworkX快速找到环的个数和节点信息

        参数:
        nx_graph: NetworkX图对象

        返回:
        tuple: (环的总数, 环信息列表)
        """
        # 获取所有环的基础集合
        cycles = nx.cycle_basis(nx_graph)

        cycle_mean_length = 0
        for i, cycle in enumerate(cycles):
            cycle_mean_length += 1/len(cycle)

        return len(cycles), cycle_mean_length/len(cycles) if cycle_mean_length > 0 else 0



    def get_evaluation_metric(self, adj_matrix, selected_ins):
        """
        Determine the connectivity of the subgraph in the semantic map based on the selected form.
        :param adj_matrix: adjacency matrix
        :param selected_ins: form index list
        :return:
        """
        try:
            nx_graph = nx.from_numpy_array(adj_matrix)

            # 环情况
            circle_num, circle_mean_length = self.find_cycles_networkx(nx_graph)
            print("环总数：", circle_num)
            print(f"环平均长度：{circle_mean_length:.3f}")

            # connectivity status of the subgraph corresponding to the selected forms
            connected_flag_list = []
            # names of the forms corresponding to all disconnected subgraphs
            unconnected_forms = []
            # iterate over each form and examine the connectivity of the subgraph
            for form_idx, form in enumerate(self.tfM[selected_ins, :]):
                # construct subgraph based on non-zero features
                sub_nx_graph = nx_graph.subgraph({ix for ix, semantics in enumerate(form) if semantics > 0})
                # check the connectivity of the subgraph
                connected_flag = nx.is_connected(sub_nx_graph)
                connected_flag_list.append(connected_flag)
                if not connected_flag:
                    unconnected_forms.append(self.formNames[form_idx])

            # coverage, productivity
            coverage = sum(connected_flag_list) / len(selected_ins)
            productivity = None
            if len(self.unique_featNames) < 20:
                poss_subgraph_list = self.get_poss_subgraph(nx_graph, len(self.unique_featNames))
                productivity = sum(connected_flag_list) / len(poss_subgraph_list)

            # degree
            deg = [d for _, d in nx_graph.degree()]
            deg_mean = np.mean(deg)
            deg_std = np.std(deg)

            # acc，p, r, f1
            evaluation = self.evaluate_against_gt(adj_matrix)

            # weight sum
            weight_sum = sum(data.get('weight', 1) for u, v, data in nx_graph.edges(data=True))

            # number of edges
            num_edges = nx_graph.number_of_edges()

            return {
                "acc": evaluation.get("acc", None),
                "prec": evaluation.get("precision", None),
                "recall": evaluation.get("recall", None),
                "F1": evaluation.get("f1", None),
                "weight_sum": weight_sum,
                "deg_mean": deg_mean,
                "deg_std": deg_std,
                "productivity": productivity,
                "coverage": coverage,
                "unconnected_forms": unconnected_forms,
                "num_edges": num_edges # 前端是否需要？
            }
        except Exception as e:
            print(e)
            return {}



    def get_all_matrix(self):
        """
        return the fully connected adjacency matrix and the adjacency matrices of all candidate trees.
        """
        # generate candidate trees
        start = time.time()
        self.get_optimal_SpanningTrees()
        end = time.time()
        print(f"get_all_matrix time: {end-start}")
        # fully connected adjacency matrix and the adjacency matrices corresponding to candidate trees
        return {
            'origin_matrix': self.adjM,
            'trees': [nx.to_numpy_array(tree) for tree in self.trees]
        }



    def check_subgraph_connectivity(self, nx_graph, selected_ins) -> list:
        """
        Check the connectivity of the subgraph in the semantic map based on the selected forms.
        :param nx_graph: The graph to be checked
        :param selected_ins: The index list corresponding to the form that requires connectivity check
        :return: unconnected_forms: Unconnected form list
        """
        # 子图连通标志
        # connected_flag_list = []
        unconnected_forms = []

        # 遍历每个form 查看每个form对应的所有语义节点构成的子图的连接情况
        for form_index in selected_ins:
            form = self.tfM[form_index, :]
            # 根据子节点构建子图
            sub_nx_graph = nx_graph.subgraph({ix for ix, semantics in enumerate(form) if semantics > 0})
            # 判断连通性
            connected_flag = nx.is_connected(sub_nx_graph)
            # connected_flag_list.append(connected_flag)
            # 记录未连通的form index
            if not connected_flag:
                unconnected_forms.append(form_index)
        return unconnected_forms



    def get_candidate_edges(self, unconnect_form_index_list) -> list:
        """
        Retrieve candidate edges for merging based on all disconnected forms.
        :param unconnect_form_index_list: unconnected form index
        :return: Sorted candidate edge list
        """
        possible_edges = []

        # 逐 form 遍历
        for form_index in unconnect_form_index_list:
            # 不连通的 form
            feat_list = [feat_index for feat_index in range(len(self.unique_featNames)) if
                         self.tfM[form_index, feat_index] != 0]
            # print(feat_list)
            # print(nx.to_numpy_array(self.G))
            if len(feat_list) < 2:
                continue
            # 获取边的权重
            for feat_index in range(len(feat_list)):
                for feat_index_after in range(feat_index + 1, len(feat_list)):
                    node1 = feat_list[feat_index]
                    node2 = feat_list[feat_index_after]
                    edge = self.G.get_edge_data(node1, node2)
                    weight = 0.00001
                    if edge:
                        weight = self.G.get_edge_data(node1, node2)['weight']
                    possible_edges.append((node1, node2, {'weight': weight}))

        # 统计边的次数（只考虑节点对，忽略权重）
        edges_without_attributes = [(u, v) for u, v, _ in possible_edges]
        edge_counts = Counter(edges_without_attributes)

        # 构建一个包含次数和最大权重的结构
        edge_info = {}
        for u, v, attr in possible_edges:
            edge = (u, v)
            weight = attr['weight']
            if edge not in edge_info:
                edge_info[edge] = {"count": edge_counts[edge], "max_weight": weight} # 优先级考虑，先count再weight
            else:
                edge_info[edge]["max_weight"] = max(edge_info[edge]["max_weight"], weight)

        # 排序：按次数和最大权重的累加降序进行排序
        # sorted_edges_by_number = sorted(
        #     edge_info.items(),
        #     key=lambda x: x[1]["count"] + x[1]["max_weight"],
        #     reverse=True,
        # )
        # 排序：优先按照count再根据weight进行降序排序
        sorted_edges_by_number = sorted(
            edge_info.items(),
            key=lambda x: (-x[1]["count"], -x[1]["max_weight"])
        )
        sorted_edges_by_number = [(edge[0], edge[1], {'weight': info['max_weight'], 'count': info['count']}) for
                                  edge, info in sorted_edges_by_number]

        return sorted_edges_by_number



    def merge_edge(self, adj_matrix):

        start = time.time()
        self.connected_graph()

        # 选择所有form
        selected_ins = range(len(self.formNames))

        nx_graph = nx.from_numpy_array(adj_matrix)

        # 原始图的子图连接情况
        unconnect_form_index_list = self.check_subgraph_connectivity(nx_graph, selected_ins)
        sorted_edges_by_number = self.get_candidate_edges(unconnect_form_index_list)

        # 'CO-CD'
        # 添加的边需要高亮出来
        highlight_edges = list()

        # 全连通后跳出循环停止merge
        while unconnect_form_index_list and sorted_edges_by_number:
            # last_unconnect_form_index_list = unconnect_form_index_list

            # 首先是最大count的edge
            confirm_edge = sorted_edges_by_number[0]
            # 可能引起的未连通变化
            max_unconnected_form_change = 0
            new_unconnect_form_index_list = unconnect_form_index_list
            # 第一个未出现在图中的候选边
            is_first_edge = True

            for index, e in enumerate(sorted_edges_by_number):
                # 构建临时图 深拷贝
                temporary_graph = copy.deepcopy(nx_graph)

                # 在图中 跳过
                if (e[0], e[1]) in temporary_graph.edges or (e[1], e[0]) in temporary_graph.edges:
                    continue
                # 不在图中
                else:
                    if is_first_edge:
                        confirm_edge = e
                        is_first_edge = False
                    # 给临时graph添加候选边
                    temporary_graph.add_edge(e[0], e[1], **e[2])
                    # 查看添加候选边后未连通子图的变化情况
                    temporary_unconnect_form_index_list = self.check_subgraph_connectivity(temporary_graph, unconnect_form_index_list)
                    # 变化的数量
                    unconnected_form_change = len(unconnect_form_index_list) - len(temporary_unconnect_form_index_list)
                    # 更新本轮的最大变化 以及 带来变化的候选边 以及变化后的未连通子图情况
                    # 必须是大于，不能是大于等于
                    if unconnected_form_change > max_unconnected_form_change:
                        max_unconnected_form_change = unconnected_form_change
                        confirm_edge = e
                        new_unconnect_form_index_list = temporary_unconnect_form_index_list
                    # temporary_graph.remove_edge(e[0], e[1])

            # 添加边
            nx_graph.add_edge(confirm_edge[0], confirm_edge[1], **confirm_edge[2])
            highlight_edges.append((confirm_edge[0], confirm_edge[1], confirm_edge[2].get('weight')))
            # 更新未连通情况：merge当前边后的未连通情况
            unconnect_form_index_list = new_unconnect_form_index_list
            # 更新候选边：从候选列表中剔除已经被merge的边
            sorted_edges_by_number = self.get_candidate_edges(unconnect_form_index_list)

            ## 有可能添加了某个边后子图连通性未发生任何变化！！！！！！


        nx_graph_merged_matrix = nx.to_numpy_array(nx_graph)
        print(highlight_edges)

        end = time.time()
        print(f"merge_edge time: {end-start}")

        return nx_graph_merged_matrix, highlight_edges









