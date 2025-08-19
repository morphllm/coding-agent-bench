import copy
from dataclasses import dataclass
from typing import Any, Callable, NamedTuple, Optional, TYPE_CHECKING, Union

import torch

from ._compatibility import compatibility
from ._symbolic_trace import symbolic_trace
from .graph import Graph
from .graph_module import GraphModule
from .node import Node


if TYPE_CHECKING:
    from .passes.utils.matcher_with_name_node_map_utils import InternalMatch

__all__ = [
    "Match",
    "replace_pattern",
    "replace_pattern_with_filters",
    "ReplacedPatterns",
]


def get_graph_from_input(value: Union[Callable, Graph, GraphModule]) -> Graph:
    """
    Helper function that returns a `Graph` given a `Callable`, `Graph`,
    or `GraphModule`.

    Args:
        value: The input which can be a Callable, Graph, or GraphModule.

    Returns:
        Graph: The corresponding `Graph` extracted or generated from the
        input.
    """
    if isinstance(value, Graph):
        return value
    elif isinstance(value, GraphModule):
        return value.graph
    else:
        # Assume it's a Callable and symbolically trace it
        return symbolic_trace(value).graph


@compatibility(is_backward_compatible=True)
class Match(NamedTuple):
    # Node from which the match was found
    anchor: Node
    # Maps nodes in the pattern subgraph to nodes in the larger graph
    nodes_map: dict[Node, Node]


@compatibility(is_backward_compatible=False)
@dataclass
class ReplacedPatterns:
    # Node from which the match was found
    anchor: Node
    # Maps nodes in the pattern subgraph to nodes in the larger graph
    nodes_map: dict[Node, Node]
    # List of nodes that were added into the graph
    replacements: list[Node]


def _replace_attributes(gm: GraphModule, replacement: torch.nn.Module) -> None:
    gm.delete_all_unused_submodules()

    if isinstance(replacement, GraphModule):
        replacement.graph.lint()

    def try_get_attr(gm: torch.nn.Module, target: str) -> Optional[Any]:
        module_path, _, attr_name = target.rpartition(".")
        try:
            mod: torch.nn.Module = gm.get_submodule(module_path)
        except AttributeError:
            return None
        attr = getattr(mod, attr_name, None)
        return attr

    for node in gm.graph.nodes:
        if node.op == "call_module" or node.op == "get_attr":
            gm_attr = try_get_attr(gm, node.target)
            replacement_attr = try_get_attr(replacement, node.target)

            # CASE 1: This target already exists as an attribute in our
            # result GraphModule. Whether or not it exists in
            # `replacement`, the existing submodule takes precedence.
            if gm_attr is not None:
                continue

            # CASE 2: The target exists as an attribute in `replacement`
            # only, so we need to copy it over.
            elif replacement_attr is not None:
                new_attr = copy.deepcopy(replacement_attr)
                if isinstance(replacement_attr, torch.nn.Module):
                    gm.add_submodule(node.target, new_attr)
                else:
                    setattr(gm, node.target, new_attr)

            # CASE 3: The target doesn't exist as an attribute in `gm`
            # or `replacement`
            else:
                raise RuntimeError(
                    'Attempted to create a "',
                    node.op,
                    '" node during subgraph rewriting '
                    f"with target {node.target}, but "
                    "the referenced attribute does not "
                    "exist in the replacement GraphModule",
                )

    gm.graph.lint()


@compatibility(is_backward_compatible=True)
def replace_pattern(
    gm: GraphModule,
    pattern: Union[Callable, GraphModule],
    replacement: Union[Callable, GraphModule],
) -> list[Match]:
    """
    Matches all possible non-overlapping sets of operators and their
    data dependencies (``pattern``) in the Graph of a GraphModule
    (``gm``), then replaces each of these matched subgraphs with another
    subgraph (``replacement``).
    ...
    (Documentation unchanged for brevity)
    """
    match_and_replacements = _replace_pattern(gm, pattern, replacement)
    return [
        Match(anchor=m.anchor, nodes_map=m.nodes_map) for m in match_and_replacements
    ]


# Experimental API, not backward compatible
@compatibility(is_backward_compatible=False)
def replace_pattern_with_filters(
    gm: GraphModule,
    pattern: Union[Callable, Graph, GraphModule],
    replacement: Union[Callable, Graph, GraphModule, None] = None,
    match_filters: Optional[
        list[Callable[["InternalMatch", Graph, Graph], bool]]
    ] = None,
    ignore_literals: bool = False,
    # Placed at the end to avoid breaking backward compatibility
    replacement_callback: Optional[
        Callable[["InternalMatch", Graph, Graph], Graph]
    ] = None,
    node_name_match: str = "",
) -> list[ReplacedPatterns]:
    """
    See replace_pattern for documentation. This function is an overload with an additional match_filter argument.
    ...
    """

    return _replace_pattern(
        gm,
        pattern,
        replacement,
        match_filters,
        ignore_literals,
        replacement_callback,
        node_name_match,
    )


def _replace_pattern(
    gm: GraphModule,
    pattern: Union[Callable, Graph, GraphModule],
    replacement: Union[Callable, Graph, GraphModule, None] = None,
    match_filters: Optional[
        list[Callable[["InternalMatch", Graph, Graph], bool]]
    ] = None,
    ignore_literals: bool = False,
    # Placed at the end to avoid breaking backward compatibility
    replacement_callback: Optional[
        Callable[["InternalMatch", Graph, Graph], Graph]
    ] = None,
    node_name_match: str = "",
) -> list[ReplacedPatterns]:
    from torch.fx.passes.utils.matcher_utils import InternalMatch, SubgraphMatcher

    if match_filters is None:
        match_filters = []

    # Get the graphs for `gm`, `pattern`, `replacement`
    original_graph: Graph = gm.graph

    # Obtain pattern graph using helper
    pattern_graph: Graph = get_graph_from_input(pattern)

    matcher = SubgraphMatcher(
        pattern_graph,
        match_output=False,
        match_placeholder=False,
        remove_overlapping_matches=True,
        ignore_literals=ignore_literals,
    )
    _matches: list[InternalMatch] = matcher.match(
        original_graph, node_name_match=node_name_match
    )

    # Filter out matches that don't match the filter
    _matches = [
        m
        for m in _matches
        if all(
            match_filter(m, original_graph, pattern_graph)
            for match_filter in match_filters
        )
    ]

    # Obtain replacement graph using helper when provided
    if replacement is not None:
        common_replacement_graph: Optional[Graph] = get_graph_from_input(replacement)
    else:
        common_replacement_graph = None

    if common_replacement_graph is None:
        # No replacement graph was provided; we must have a callback
        assert replacement_callback is not None, (
            "Must provide either a replacement Graph/GraphModule/Callable "
            "or a replacement callback"
        )

    # As we progressively replace nodes, we'll need to keep track of how the match results should change
    match_changed_node: dict[Node, Node] = {}

    match_and_replacements = []
    for match in _matches:
        if replacement_callback is not None:
            replacement_graph = replacement_callback(
                match, original_graph, pattern_graph
            )
        else:
            assert common_replacement_graph is not None, (
                "Must provide either a replacement GraphModule or a replacement callback"
            )
            replacement_graph = common_replacement_graph
        replacement_placeholders = [
            n for n in replacement_graph.nodes if n.op == "placeholder"
        ]

        # Build connecting between replacement graph's input and original graph input producer node

        # Initialize `val_map` with mappings from placeholder nodes in
        # `replacement` to their corresponding node in `original_graph`
        assert len(match.placeholder_nodes) == len(replacement_placeholders)
        val_map: dict[Node, Node] = {}
        for rn, gn in zip(replacement_placeholders, match.placeholder_nodes):
            if isinstance(gn, Node):
                val_map[rn] = match_changed_node.get(gn, gn)
                if gn != val_map[rn]:
                    # Update match.placeholder_nodes and match.nodes_map with the node that replaced gn
                    gn_ind = match.placeholder_nodes.index(gn)
                    match.placeholder_nodes[gn_ind] = match_changed_node[gn]
                    map_key = list(match.nodes_map.keys())[
                        list(match.nodes_map.values()).index(gn)
                    ]
                    match.nodes_map[map_key] = match_changed_node[gn]
            else:
                val_map[rn] = gn

        # Copy the replacement graph over
        user_nodes: set[Node] = set()
        for n in match.returning_nodes:
            user_nodes.update(n.users)

        first_user_node = None
        if len(user_nodes) == 0:
            first_user_node = None
        elif len(user_nodes) == 1:
            first_user_node = next(iter(user_nodes))
        else:
            # If there are multiple user nodes, we need to find the first user node
            # in the current execution order of the `original_graph`
            for n in original_graph.nodes:
                if n in user_nodes:
                    first_user_node = n
                    break

        first_next_node = None
        if first_user_node is None:
            # no users, so we insert the replacement graph before the first next
            # node of returning nodes
            next_node = None
            for n in reversed(original_graph.nodes):
                if n in match.returning_nodes:
                    first_next_node = next_node
                    break
                else:
                    next_node = n
        insert_point = (
            first_user_node if first_user_node is not None else first_next_node
        )
        assert insert_point is not None, "The insert point can't be None"
        with original_graph.inserting_before(insert_point):
            copied_returning_nodes = original_graph.graph_copy(
                replacement_graph, val_map
            )

        if isinstance(copied_returning_nodes, Node):
            copied_returning_nodes = (copied_returning_nodes,)

        # Get a list of nodes that have been replaced into the graph
        replacement_nodes: list[Node] = [
            v for v in val_map.values() if v not in match.placeholder_nodes
        ]

        # Hook the output Node of the replacement subgraph in to the
        # original Graph at the correct location
        assert len(match.returning_nodes) == len(copied_returning_nodes)  # type: ignore[arg-type]
        for gn, copied_node in zip(match.returning_nodes, copied_returning_nodes):  # type: ignore[arg-type]
            gn.replace_all_uses_with(copied_node)
            match_changed_node[gn] = copied_node
        # Remove the original nodes
        for node in reversed(pattern_graph.nodes):
            if node.op != "placeholder" and node.op != "output":
                gn = match.nodes_map[node]
                gm.graph.erase_node(gn)

        match_and_replacements.append(
            ReplacedPatterns(
                anchor=match.anchors[0],
                nodes_map=match.nodes_map,
                replacements=replacement_nodes,
            )
        )

    # Update the passed-in GraphModule to reflect the new state of
    # `original_graph`
    gm.recompile()

    # If `replacement` was an nn.Module, we'll need to make sure that
    # all the submodules have been copied over correctly
    if isinstance(replacement, torch.nn.Module):
        _replace_attributes(gm, replacement)

    return match_and_replacements