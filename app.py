from flask import Flask, request, jsonify, send_from_directory
from SMM import SemanticMap
from utils import port

import numpy as np
import pandas as pd
import uuid
import traceback
import time

app = Flask(__name__, static_folder='./')


@app.route('/')
def index():
    return send_from_directory('./', 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('./', path)


@app.route('/api/process-excel', methods=['POST'])
def process_excel():
    """
    Generate a semantic map based on the xlsx data parsed by the frontend.
    """
    try:
        # Fetch request data
        data = request.json.get('data', [])
        label= request.json.get('label', [])

        # Check data.
        if not data or not isinstance(data, list):
            return jsonify({'error': 'Invalid data format.'}), 400
        if not isinstance(label, list):
            label = []

        # Convert the data into a DataFrame.
        df = pd.DataFrame(data)
        df_label = pd.DataFrame(label)

        # Check whether the data is standardized.
        v_result = validate_data(df)
        # Validation failed; return error code.
        if v_result != 'standard':
            return jsonify({'error': v_result}), 400

        # Process and standardize the data.
        features, forms, co_occurrence_matrix = process_data(df)
        ground_truth = process_label(df_label, features)

        # Generate the adjacency matrix corresponding to the candidate tree.
        semantic_maps = SemanticMap(co_occurrence_matrix, features, forms, None, ground_truth, 0, calc_type='G')
        matrix_data = semantic_maps.get_all_matrix()

        # Convert from matrix to graph format as required by the frontend.
        graph_data = list()
        node_labels = semantic_maps.unique_featNames

        # origin_matrix_data = matrix_data.get('origin_matrix')
        # origin_matrix_data = process_symmetric_matrix(origin_matrix_data)
        # origin_graph_data = convert_to_graph_data('Initial fully connected conceptual space ', origin_matrix_data, node_labels)
        # # 评价当前图
        # origin_evaluation_metric = semantic_maps.get_evaluation_metric(origin_matrix_data, range(len(semantic_maps.formNames)))
        # origin_graph_data['evaluation_metric'] = origin_evaluation_metric
        # graph_data.append(origin_graph_data)

        trees_matrix_data = matrix_data.get('trees')
        start_evaluation = time.time()
        for index, tree_matrix in enumerate(trees_matrix_data):
            # Process the symmetric adjacency matrix.
            tree_matrix = process_symmetric_matrix(tree_matrix)
            tree_graph_data = convert_to_graph_data('Candidate semantic map '+str(index+1), tree_matrix, node_labels)
            # Evaluate the current semantic map.
            tree_evaluation_metric = semantic_maps.get_evaluation_metric(tree_matrix, range(len(semantic_maps.formNames)))
            tree_graph_data['evaluation_metric'] = tree_evaluation_metric
            graph_data.append(tree_graph_data)
        end_evaluation = time.time()
        print('Evaluation time elapsed: ', (end_evaluation-start_evaluation)*1000)

        # Retrieve the forms and the corresponding nodes for each form in the semantic map.
        feature_map = semantic_maps.tfM
        forms_with_nodes = get_forms_with_nodes(df, feature_map)

        ret = {
            'graph_data': graph_data,
            'forms_with_nodes': forms_with_nodes
        }
        return jsonify(ret)

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/merge-edges', methods=['POST'])
def merge_edges():
    """
    Automatically add edges to make the semantic map fully connected.
    """
    try:
        # Fetch request data
        data = request.json.get('data', [])
        label = request.json.get('label', [])
        graph = request.json.get('graph', {})

        if not data or not graph:
            return jsonify({'error': 'The backend failed to parse the data. Please check the file format and content.'}), 400

        # Convert the data into a DataFrame.
        df = pd.DataFrame(data)
        df_label = pd.DataFrame(label)

        # Check whether the data is standardized.
        v_result = validate_data(df)
        if v_result != 'standard':
            return jsonify({'error': v_result}), 400

        # Process and standardize the data.
        features, forms, co_occurrence_matrix = process_data(df)
        ground_truth = process_label(df_label, features)

        # Parse the current map information.
        adjacency_matrix, map_name = process_graph(graph)
        adjacency_matrix = process_symmetric_matrix(adjacency_matrix)

        # Merge edges
        semantic_maps = SemanticMap(co_occurrence_matrix, features, forms, None, ground_truth, 0, calc_type='G')
        adjacency_matrix_merged, merged_edges_info = semantic_maps.merge_edge(adjacency_matrix)

        # Convert from edges to graph format as required by the frontend.
        graph_data = dict()
        edges = convert_to_graph_data_merged(merged_edges_info)
        graph_data['edges'] = edges

        # Evaluate the merged semantic map.
        evaluation_metric = semantic_maps.get_evaluation_metric(adjacency_matrix_merged, range(len(forms)))
        graph_data['evaluation_metric'] = evaluation_metric

        # Retrieve the forms and the corresponding nodes for each form in the semantic map.
        feature_map = semantic_maps.tfM # tfm and co_occurrence_matrix are not the same—deduplication may have been applied.
        forms_with_nodes = get_forms_with_nodes(df, feature_map)

        ret = {
            'graph_data': graph_data,
            'forms_with_nodes': forms_with_nodes
        }
        return jsonify(ret)

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@app.route('/api/edge-modify', methods=['POST'])
def edge_modify_evaluate():
    """
    Evaluation of the artificially modified semantic map.
    """
    try:
        # Fetch request data
        data = request.json.get('data', [])
        label = request.json.get('label', [])
        graph = request.json.get('graph', {})

        if not data or not graph:
            return jsonify({'error': 'The backend failed to parse the data. Please check the file format and content.'}), 400

        # Convert the data into a DataFrame.
        df = pd.DataFrame(data)
        df_label = pd.DataFrame(label)

        # Check whether the data is standardized.
        v_result = validate_data(df)
        if v_result != 'standard':
            return jsonify({'error': v_result}), 400

        # Process and standardize the data.
        columns, forms, np_data = process_data(df)
        ground_truth = process_label(df_label, columns)

        # Parse the current map information.
        adjacency_matrix, map_name = process_graph(graph)
        adjacency_matrix = process_symmetric_matrix(adjacency_matrix)

        # Evaluate the modified semantic map.
        semantic_maps = SemanticMap(np_data, columns, forms, None, ground_truth, 0, calc_type='G')
        evaluation_metric = semantic_maps.get_evaluation_metric(adjacency_matrix, range(len(forms)))

        return jsonify(evaluation_metric)

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500



def validate_data(df):
    """
    Validate whether the data conforms to the specifications.
    """
    # Rule 1: First column must be 'languages'
    if df.columns[0] != 'languages':
        return "First column must be named 'languages'."

    # Rule 2: Second column must be 'forms'
    if df.columns[1] != 'forms':
        return "Second column must be named 'forms'."

    # Rule 3: At least two more columns after the first two
    if len(df.columns) < 4:
        return "There must be at least two more columns (features) after 'languages' and 'forms'."

    # Rule 4: At least one row of data
    if len(df) == 0:
        return "The file must contain at least one row of data (one form)."

    # Rule 5: All remaining columns must have numeric (int or float) data
    numeric_cols = df.iloc[:, 2:]
    for col in numeric_cols.columns:
        if not pd.api.types.is_numeric_dtype(numeric_cols[col]):
            return f"Feature '{col}' must contain only numeric (integer or float) values."

    return 'standard'



def process_label(df: pd.DataFrame, expected_columns: list):
    """
    Validate the ground truth data and standardize it.
    """
    if df.empty:
        return None

    # Or the column names（features）from the ground truth table.
    actual_columns = df.columns.tolist()[1:]
    # actual_columns = sorted(actual_columns)

    # Validation Rule 1: Check whether the column names match.
    if actual_columns != expected_columns:
        print("The ground truth data is inconsistent: the features and the co-occurrence table do not match.")
        return None

    # Validation Rule 2: Check whether the rows and column names are consistent.
    first_column_data = df.iloc[:, 0].tolist()
    if first_column_data != actual_columns:
        print("The ground truth data is problematic: rows and columns must be consistent.")
        return None

    # Fill in the missing values.
    df.iloc[:, 0] = df.iloc[:, 0].fillna('<unk>')
    df.fillna(0, inplace=True)

    # Return the ground truth adjacency matrix.
    return df.iloc[:, 1:].to_numpy()



def process_data(df):
    """
    Standardize the tabular data and create a corresponding NumPy matrix for subsequent adjacency matrix generation.
    """
    # Fill in the missing values.
    df.fillna({'languages': '<unk>', 'forms': '<unk>'}, inplace=True)
    df.fillna(0, inplace=True)
    # All column names.
    columns = df.columns.tolist()
    # Raw data only.
    numeric_cols = df.iloc[:, 2:]
    # Extract the languages and forms columns and combine them into a list of dictionaries.
    forms = df[['languages', 'forms']].apply(
        lambda row: {'language': row['languages'], 'form': row['forms']}, axis=1
    ).tolist()
    # Convert to numpy array
    co_occurrence_matrix = numeric_cols.to_numpy(dtype=np.float64)

    return columns[2:], forms, co_occurrence_matrix



def process_graph(graph):
    """
    Create an adjacency matrix based on the map information.
    """
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    name = graph.get("map_name", "")

    num_nodes = len(nodes)

    if not nodes:
        return None, name
    elif not edges:
        return np.zeros((num_nodes, num_nodes), dtype=float), name

    # Create a mapping from node IDs to indices.
    node_id_to_index = {node["id"]: idx for idx, node in enumerate(nodes)}

    # Initialize the adjacency matrix.
    adj_matrix = np.zeros((num_nodes, num_nodes), dtype=float)

    # Populate the adjacency matrix.
    for edge in edges:
        from_id = edge["from"]
        to_id = edge["to"]
        value = edge["value"]  # Use float type as edge weights.

        if from_id in node_id_to_index and to_id in node_id_to_index:
            i = node_id_to_index[from_id]
            j = node_id_to_index[to_id]
            adj_matrix[i][j] = value  # If it's a directed graph, assign the weight in only one direction.
            # adj_matrix[j][i] = value

    return adj_matrix, name



def process_symmetric_matrix(matrix):
    """
    Determine whether the input matrix is symmetric.
    If it is, return its upper triangular matrix with the main diagonal set to 0;
    otherwise, return the original matrix.
    """
    if not isinstance(matrix, np.ndarray):
        raise ValueError("The input must be a NumPy ndarray.")

    if matrix.shape[0] != matrix.shape[1]:
        return matrix

    if np.array_equal(matrix, matrix.T):
        # If it is a symmetric matrix, take the upper triangular part and set the diagonal to 0.
        upper_triangle = np.triu(matrix, k=1)  # k=1 means the main diagonal is excluded.
        return upper_triangle
    else:
        return matrix



def convert_to_graph_data_merged(edges:list):
    """
    Convert the edge list into the format required for frontend visualization.
    """
    graph_edges = list()
    for edge in edges:
        graph_edges.append({
            'id': f'e{uuid.uuid4().hex[:8]}',
            'from': str(edge[0]),
            'to': str(edge[1]),
            'label': str(edge[2]),
            'value': float(edge[2])
        })
    return graph_edges



def convert_to_graph_data(map_name, adjacency_matrix, node_labels):
    """
    Convert the adjacency matrix into the format required for frontend visualization.
    """
    nodes = []
    edges = []

    # Create nodes.
    for i, label in enumerate(node_labels):
        nodes.append({
            'id': str(i),
            'label': str(label),
            'title': str(label)
        })

    # Create edges.
    for i in range(len(adjacency_matrix)):
        for j in range(len(adjacency_matrix[i])):
            weight = adjacency_matrix[i][j]
            if weight > 0:
                edge_id = f'e{uuid.uuid4().hex[:8]}'
                edges.append({
                    'id': edge_id,
                    'from': str(i),
                    'to': str(j),
                    'label': str(weight),
                    'value': float(weight)
                })

    return {'map_name': map_name, 'nodes': nodes, 'edges': edges}



def get_forms_with_nodes(df, feature_map):
    """
    Get all forms with the given feature_map.
    feature_map is the deduplicated form-feature matrix, not the original co-occurrence matrix.
    """
    # Get the column names of the first two columns.
    col1 = df.columns[0] # languages
    col2 = df.columns[1] # forms

    # Extract the data from the first two columns and convert it to a list.
    languages = df[col1].tolist()
    forms = df[col2].tolist()

    all_forms_with_nodes = list()

    # Iterate over each row.
    for row in range(feature_map.shape[0]):
        form = forms[row]
        language = languages[row]
        related_cols = list()
        # Iterate over each column.
        for col in range(feature_map.shape[1]):
            if feature_map[row, col] > 0:
                # The column index serves as the node_id.
                related_cols.append(str(col))
        all_forms_with_nodes.append({'language': language, 'form': form, 'nodes': related_cols})

    return all_forms_with_nodes




if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=port)