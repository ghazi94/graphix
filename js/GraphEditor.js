// Graph info elements
var graphNameDom = $('#graphName');
var graphVersionDom = $('#graphVersion');
var graphUrlDom = $('#graphUrl');
// Message box
var messageBox = $('#messages');

// Graph Canvas
// DOM Canvas Element
var holderCanvas = document.getElementById("holderCanvas");

// Toggle Switches
var addChildToggleSwitch = $('#addChildToggle').length ? $('#addChildToggle')[0] : null;
var addLinkToggleSwitch = $('#addLinkToggle').length ? $('#addLinkToggle')[0] : null;
var removeLinkToggleSwitch = $('#removeLinkToggle').length ? $('#removeLinkToggle')[0] : null;
var highlightNextPathToggleSwitch = $('#highlightNextPathToggle').length ? $('#highlightNextPathToggle')[0] : null;
var removeNodeToggleSwitch = $('#removeNodeToggle').length ? $('#removeNodeToggle')[0] : null;
var editNodeToggleSwitch = $('#editNodeToggle').length ? $('#editNodeToggle')[0] : null;

// Function which returns the state of toggle switches and the mode they specify
function isEditMode(mode) {
    // Mutliple edit modes should not be on simultaenously
    if (mode == "any" && (addChildToggleSwitch.checked || 
        addLinkToggleSwitch.checked || 
        removeLinkToggleSwitch.checked || 
        highlightNextPathToggleSwitch.checked ||
        removeNodeToggleSwitch.checked || 
        editNodeToggleSwitch.checked)) {
        return true;
    } // Below states are ordered by their least destructive nature 
    else if (mode == "highlightPath" && highlightNextPathToggleSwitch.checked) {
        return true;
    } else if (mode == "editNode" && editNodeToggleSwitch.checked) {
        return true;
    } else if (mode == "addChild" && addChildToggleSwitch.checked) {
        return true;
    } else if (mode == "addLink" && addLinkToggleSwitch.checked) {
        return true;
    } else if (mode == "removeLink" && removeLinkToggleSwitch.checked) {
        return true;
    } else if (mode == "removeNode" && removeNodeToggleSwitch.checked) {
        return true;
    }

    return false;
}

// Add attribute to node button
var addAttributeToEdge = $('#addKeyValuePair');
// Save Node Button
var updateNodeButton = $('#updateNodeButton');

// Graph fetch and save buttons
var fetchGraphButton = $('#fetchGraphButton');
var saveGraphButton = $('#saveGraphButton');

var snapshotCanvas = $('#saveCanvasImage');

// Static graph data from locally stored file
var graphInfo = pricing_static_graph_data;

// Denotes whether the graph has been fetched from DB or not!
var synced = false;

// Inner scope function holder - Used to pass generateDrawing's inner functions to outer scope
var innerScopeFunctionHolder = {};

// GRAPH OPERATIONS AND STATE MANAGEMENT
// -------------------------------------
// A map of nodes with key as node id and value as node
var nodesIndexedById = {};
// A map of node properties with key as node id and value as object containing UI properties
// The properties stored here are generated here like X, Y, rgb, level, orphan etc.
// This object can contain stray nodes (non-existent) nodes too, as they don't have any effect on the graph operations
var nodePropertiesIndexedById = {};
// Node appearing the highest visually (The 0,0 starts from top left)
// This property helps us in assigning Y ordinate for the orphaned nodes (node which cannot be reached via edges)
var minimumY = null;
// The X ordinate of the last orphaned node
var lastOrphanX = 0;
// A map of paths with key as node id and value as list of node ids reachable from it
var fromNodePathToNodes = {};
// A map of edges with key as edge id and value as edge
var edgesIndexedById = {};
// A map with
// Key as: fromNode,toNode  (String)
// Value as: { edgeId : ?, traversalCount : ?} (Object) // Note: Not storing edgeId for now
// traversalCount will help detect cyclic traversals
var traversalMapIndex = {};
// An array containing an array of nodes at a particular level
// The index of the array denotes the level
// The root node is at level 0. Nodes reachable from root are at level 1, and so on..
var traversalLevels = [];
// Root node of the graph
// If no node is set as root, the first node in nodes index will be used to start the traversal
var rootNode = null;
// Array storing the nodes which have been clicked in succession
// A click in empty space resets the array
// The last node in this array is the node most recently clicked
// Multiple clicks on the same node fills this array multiple times (intentionally)
var nodeIdsClickSequence = [];
// Helps reset the UI properties of circle when mouse is no longer over it
var lastNodeUnderMouseProps = {
    'nodeId' : null,
    // Stores the rgb the circle had before being highlighted
    'rgb' : null,
    // Helps reset the children back to their normal state (for highlighted mode operation)
    'highlightedChildrenIds' : []
};

// Helps store the information, which is being currently stored in the sidebar (The DOM Part which shows
// node name, level and edge attributes)
var sideBarData = {};
// Start Processing.js and render the graph
var graphProcessor = new Processing(holderCanvas, generateDrawing);

function resetStateVariables(severity, specific) {
    if (!specific) {
        nodesIndexedById = {};
        mimimumY = null;
        lastOrphanX = 0;
        fromNodePathToNodes = {};
        edgesIndexedById = {};
        traversalMapIndex = {};
        traversalLevels = [];
        rootNode = null;
        lastNodeUnderMouseProps = {
            'nodeId' : null,
            'rgb' : null,
            'highlightedChildrenIds' : []
        };

        // The following data is generated through user input, hence severity must be specified for clearing them
        if (severity && severity == 1) {
            nodePropertiesIndexedById = {};
            nodeIdsClickSequence = [];
        }
    } else {
        if (specific == "sideBarData") {
            sideBarData = {};
        }
    }
}

// Simple way to attach js code to the holderCanvas is by using a function
function generateDrawing (processing) {
    // Define Canvas Dimensions
    var canvasWidth = 1200;
    var canvasHeight = 700;

    // Geometric Parameters
    // Circle denotes the graph node
    var circleDiameter = 30;
    var circleRadius = circleDiameter / 2;

    // Gap between two circles from their closest points
    // This is used creating vertical gap between circles
    var nodeGap = circleDiameter;

    // Gap between circle and the text alongside it from the center
    var textGap = nodeGap/4;

    // The difference in Y co-ordinate between two circles stacked vertically
    var verticalSeparation = circleDiameter + nodeGap;

    // The difference in X co-ordinate between two circles stacked horizontally
    var horizontalSeparation = 12*circleDiameter;
    
    // Denotes how much should string length be multipled to be approximated by pixel based length
    // Used during text render
    var pixel_factor = 5;

    var defaultBackgroundRgb = [0, 0, 0];

    var defaultCircleRgb = [33, 148, 133];
    var mouseOverCircleHighlightedRgb = [255, 129, 210];
    var mouseClickedCircleHighlightedRgb = [125, 0, 255];
    var pastClickedCircleHighlightRgb = mouseClickedCircleHighlightedRgb;
    var futurePathCircleHighlightRgb = [0, 106, 181];
    var defaultCircleStrokeWeight = 2;

    var defaultLineRgb = [255, 255, 255];
    var defaultLineStrokeWeight = 1;

    var defaultTextSize = 13;
    var defaultTextRgb = [255, 64, 64];


    // Override the setup function of processing.js
    processing.setup = function() {
        processing.size(canvasWidth, canvasHeight);
        // Decalare inner scope functions which are being used outside
        innerScopeFunctionHolder['buildXandYOrdinates'] = buildXandYOrdinates;
        innerScopeFunctionHolder['assignOrdinatesToOrphanNodes'] = assignOrdinatesToOrphanNodes;
        innerScopeFunctionHolder['highlightPath'] = highlightPath;
        // Initialize graph data, indexes and traversals
        nodeTraversalAndPlacement();
    }

    // Override draw function, by default it will be called 60 times per second!
    processing.draw = function() {
        // Sets the background of the canvas
        // Note: This should be in the loop for the canvas drawings to appear crisp
        processing.background(defaultBackgroundRgb[0], defaultBackgroundRgb[1], defaultBackgroundRgb[2]);

        // Call the actual graph rendering function
        renderGraph();
    };

    processing.mouseMoved = function() {
        if (isEditMode("any")) {
            // We have to transform the mouse co-ordinates first, because they are always
            // relative to the canvas window dimensions. Do note that this is required because we
            // are using a javascript based zoomable and pannable canvas, which emulates the effect
            // by scaling the rendered drawing
            var mousePointer = window.outerCtx.transformedPoint(processing.mouseX, processing.mouseY);
            nodeUnderMouse(mousePointer.x, mousePointer.y);
        }
    };

    processing.mouseClicked = function() {
        if (isEditMode("any")) {
            // We have to transform the mouse co-ordinates first, because they are always
            // relative to the canvas window dimensions. Do note that this is required because we
            // are using a javascript based zoomable and pannable canvas, which emulates the effect
            // by scaling the rendered drawing
            var mousePointer = window.outerCtx.transformedPoint(processing.mouseX, processing.mouseY);
            nodeClickedByMouse(mousePointer.x, mousePointer.y);
        }
    };

    function renderGraph() {
        // Render edges first
        for (var edgeId in edgesIndexedById) {
            var edge = edgesIndexedById[edgeId];
            var fromX = nodePropertiesIndexedById[edge.fromNode] ? nodePropertiesIndexedById[edge.fromNode].X : null;
            var fromY = nodePropertiesIndexedById[edge.fromNode] ? nodePropertiesIndexedById[edge.fromNode].Y : null;
            var toX = nodePropertiesIndexedById[edge.toNode] ? nodePropertiesIndexedById[edge.toNode].X : null;
            var toY = nodePropertiesIndexedById[edge.toNode] ? nodePropertiesIndexedById[edge.toNode].Y : null;
            drawLine(fromX, fromY, toX, toY, defaultLineStrokeWeight, defaultLineRgb);
        }

        // Render nodes from the node index
        // All the node properties should be fetched from nodeProperties index
        for (var nodeId in nodesIndexedById) {
            var node = nodesIndexedById[nodeId];
            if (nodePropertiesIndexedById[nodeId]) {
                drawCircle(nodePropertiesIndexedById[nodeId].X,
                            nodePropertiesIndexedById[nodeId].Y,
                            circleRadius,
                            defaultCircleStrokeWeight,
                            nodePropertiesIndexedById[nodeId].rgb);
                // Text should be center aligned and on the top of the circle
                var textX = nodePropertiesIndexedById[nodeId].X - pixel_factor*node.name.length;
                var textY = nodePropertiesIndexedById[nodeId].Y - (circleRadius + textGap);
                drawText(node.name, textX, textY, defaultTextSize, defaultTextRgb);
            }
        }
    }
    
    function nodeUnderMouse(mouseX, mouseY) {
        // First, whatever the conditions, reset the rgb of the last node which was under mouse
        if (lastNodeUnderMouseProps.nodeId) {
            var nodeId = lastNodeUnderMouseProps.nodeId;
            var highlightedChildren = lastNodeUnderMouseProps.highlightedChildrenIds;
            // Check if nodeUnderMouse has UI control or not
            if (!nodePropertiesIndexedById[nodeId].blockNodeUnderMouse) {
                nodePropertiesIndexedById[nodeId].rgb = null;
                // Clear highlighted children also
                if (highlightedChildren) {
                    for (var i=0; i<highlightedChildren.length; i++) {
                        nodePropertiesIndexedById[highlightedChildren[i]].rgb = null;
                    }
                }
            }
        }
        var targetNode = findNodeUnderMousePointer(mouseX, mouseY, circleRadius);
        // 2 possibilities

        // Mouse over a node
            // Change the rgb setting of the node (mouseOverCircleHighlightedRgb) renderGraph() will take care of the rest
        if (targetNode) {
            nodeId = targetNode.id;
            if (!nodePropertiesIndexedById[nodeId].blockNodeUnderMouse) {
                // Save the current node properties which is under the mouse
                lastNodeUnderMouseProps.nodeId = nodeId;
                nodePropertiesIndexedById[nodeId].rgb = mouseOverCircleHighlightedRgb;
                performCircleHoverOperation(nodeId);
            }
        }

        // Mouse is in empty space
            // Do nothing
            // renderGraph() will redraw the node since we have already reset the rgb of the lastNodeIdUnderMouse
    }

    function nodeClickedByMouse(mouseX, mouseY) {
        // findNodeUnderMousePointer()
        var targetNode = findNodeUnderMousePointer(mouseX, mouseY, circleRadius);
        // 2 possibilities

        // Mouse clicked on node
            // Change the rgb setting of the node (mouseClickedHighlightedRgb) renderGraph() will take care of the rest
            // Add this node to the node click sequence
            // Trigger node operations (they will check for the edit mode and perform their work)
        if (targetNode) {
            var nodeId = targetNode.id;
            // Block control to relevant UI handlers
            nodePropertiesIndexedById[nodeId].blockNodeUnderMouse = true;
            // Save this node to the node clicked sequence
            nodeIdsClickSequence.push(nodeId);
            nodePropertiesIndexedById[nodeId].rgb = mouseClickedCircleHighlightedRgb;

            // --------------------------------------------------- |||| --------------------------------------------------------
            // Perform node click mode operation
            performCircleClickOperation();
        }

        // Mouse clicked on emtpy space
            // Do nothing
            // Please do hard reset of click tracking via toggle switch change
    }

    // Geometric calculations
    
    // Build X, Y coordinates for all the nodes
    function buildXandYOrdinates() {
        // Traverses the traversalLevels array and generates X and Y ordinates for the nodes
        for (var i=0; i<traversalLevels.length; i++) {
            var currentLevel = i;
            var currentLevelNodes = traversalLevels[i];
            var numOfCirAtCurrLevel = currentLevelNodes.length;
            // Assign X coordinate for each node
            for (var j=0; j<numOfCirAtCurrLevel; j++) {
                var currentCircleId = currentLevelNodes[j];
                if (!nodePropertiesIndexedById[currentCircleId]) {
                    nodePropertiesIndexedById[currentCircleId] = {};
                }
                nodePropertiesIndexedById[currentCircleId]['X'] = (currentLevel + 1)*horizontalSeparation;
                // Now assign Y ordinate
                // Note: Y is measured from top left
                // Check if this level contains even number of nodes or odd
                if (numOfCirAtCurrLevel % 2 == 0) {
                    var lowestOrdinateOfCircles = canvasHeight/2 - 
                        ((numOfCirAtCurrLevel/2)*nodeGap + (numOfCirAtCurrLevel-1)*circleRadius);
                    nodePropertiesIndexedById[currentCircleId]['Y'] = lowestOrdinateOfCircles + j*(nodeGap + circleDiameter);
                } else {
                    var lowestOrdinateOfCircles = canvasHeight/2 - (((numOfCirAtCurrLevel-1)/2)*(nodeGap + circleDiameter));
                    nodePropertiesIndexedById[currentCircleId]['Y'] = lowestOrdinateOfCircles + j*(nodeGap + circleDiameter);
                }
                // Also save the level of the current circle
                nodePropertiesIndexedById[currentCircleId]['level'] = currentLevel;
            }
        }
    }

    function assignOrdinatesToOrphanNodes() {
        // Find out the nodes which could not be reached from directed path by buildXandYOrdinates()
        // and assigns them X and Y based on lastOrphanX and minimumY
        
        // Traverse all the nodes and compute minimumY
        for (var key in nodePropertiesIndexedById) {
            if (nodePropertiesIndexedById[key].Y) {
                if (mimimumY == null) {
                    minimumY = nodePropertiesIndexedById[key].Y;
                } else {
                    minimumY = nodePropertiesIndexedById[key].Y > minimumY ? minimumY : nodePropertiesIndexedById[key].Y;
                }
            }
        }
        // This is the extreme case where all nodes are orphans
        if (minimumY == null) {
            minimumY = 0;
        }
        for (var nodeId in nodesIndexedById) {
            if (!nodePropertiesIndexedById[nodeId]) {
                nodePropertiesIndexedById[nodeId] = {};
            }
            if (!nodePropertiesIndexedById[nodeId].X) {
                lastOrphanX = lastOrphanX + horizontalSeparation;
                nodePropertiesIndexedById[nodeId]['X'] = lastOrphanX;
                nodePropertiesIndexedById[nodeId]['Y'] = minimumY + 2*verticalSeparation;
                nodePropertiesIndexedById[nodeId]['orphan'] = true;
                nodePropertiesIndexedById[nodeId]['rgb'] = defaultCircleRgb;
            }
        }
    }

    // UI Enhancement Functions
    function highlightPath(nodeId) {
        if (!lastNodeUnderMouseProps.highlightedChildrenIds) {
            lastNodeUnderMouseProps.highlightedChildrenIds = [];
        }
        var childNodes = fromNodePathToNodes[nodeId];
        if (childNodes) {
            for (var i=0; i<childNodes.length; i++) {
                // Save the highlighted nodes so that we can clear it in the next iteration
                lastNodeUnderMouseProps.highlightedChildrenIds.push(childNodes[i]);
                nodePropertiesIndexedById[childNodes[i]].rgb = futurePathCircleHighlightRgb;
            }
        }
    }

    // Drawing functions

    // Draw circle
    function drawCircle(X, Y, radius, strokeweight, customRgb) {
        if (!(customRgb && Array.isArray(customRgb) && customRgb.length == 3)) {
            customRgb = defaultCircleRgb;
        }
         if (!strokeweight) {
            strokeweight = defaultCircleStrokeWeight;
        }
        if (X && Y && radius) {
            processing.fill(customRgb[0], customRgb[1], customRgb[2]);
            processing.strokeWeight(strokeweight);
            processing.stroke(customRgb[0], customRgb[1], customRgb[2]);
            processing.ellipse(X, Y, radius*2, radius*2);
        }
    }

    // Draw line
    function drawLine(fromX, fromY, toX, toY, strokeweight, customRgb) {
        if (!(customRgb && Array.isArray(customRgb) && customRgb.length == 3)) {
            customRgb = defaultLineRgb;
        }
         if (!strokeweight) {
            strokeweight = defaultLineStrokeWeight;
        }
        if (fromX && fromY && toX && toY) {
            processing.strokeWeight(strokeweight);
            processing.stroke(customRgb[0], customRgb[1], customRgb[2]);
            processing.line(fromX, fromY, toX, toY);
        }
    }

    // Draw text
    function drawText(text, X, Y, size, customRgb) {
        if (!(customRgb && Array.isArray(customRgb) && customRgb.length == 3)) {
            customRgb = defaultTextRgb;
        }
        if (!size) {
            size = defaultTextSize;
        }
        if (X && Y && text) {
            processing.fill(customRgb[0], customRgb[1], customRgb[2]);
            processing.textSize(size);
            processing.text(text, X, Y);
        }
    }

    function toggleSwitchChangePreparation() {
        resetStateVariables(1);
        nodeTraversalAndPlacement();
    }

    function displayError(errorMsg) {
        $(messageBox).removeClass('green-background');
        $(messageBox).val(errorMsg);
        $(messageBox).addClass('red-background');
    }

    function displayRegularMessage(message) {
        $(messageBox).removeClass('red-background');
        $(messageBox).val(message);
        $(messageBox).addClass('green-background');
    }

    // Toggle Switch Event Listeners
    $(addChildToggleSwitch).change(
        function(ev) {
            toggleSwitchChangePreparation();
    });
    $(addLinkToggleSwitch).change(
        function(ev) {
            toggleSwitchChangePreparation();
    });
    $(removeLinkToggleSwitch).change(
        function(ev) {
            toggleSwitchChangePreparation();
    });
    $(highlightNextPathToggleSwitch).change(
        function(ev) {
            toggleSwitchChangePreparation();
    });
    $(removeNodeToggleSwitch).change(
        function(ev) {
            toggleSwitchChangePreparation();
    });
    $(editNodeToggleSwitch).change(
        function(ev) {
            toggleSwitchChangePreparation();
    });

    // Button Update Listeners
    // Update the node/edge atrributes from the given form
    $(updateNodeButton).click(
        function(ev) {
            if (isEditMode("editNode")) {
                recoverDataFromSideBar();
            }
    });

    // GET GRAPH
    $(fetchGraphButton).click(
        function(ev) {
        if (isEditMode("editNode")) {
            var graphName = $(graphNameDom).val();
            var graphVersion = $(graphVersionDom).val();
            var graphUrl = $(graphUrlDom).val();
            if (graphUrl && graphName && graphVersion) {
                $.ajax({
                    method: "GET",
                    url: graphUrl + graphName + "/" + graphVersion + "?complete=true",
                    success: function(response) {
                        if (response) {
                            graphInfo = response;
                            nodeTraversalAndPlacement(1);
                            synced = true;
                        }
                    },
                    error: function(error) {
                        console.log(error);
                    }
                });
            }
        }
    });

    // SAVE GRAPH
    $(saveGraphButton).click(
        function(ev) {
            var graphUrl = $(graphUrlDom).val();
            // We always update the graph only
            // Currently we do not support creating a new graph
            if (graphInfo.id && graphInfo.name && graphInfo.version && synced) {
                $.ajax({
                    method: "PUT",
                    url: graphUrl,
                    dataType: "json",
                    contentType: "application/json; charset=utf-8",
                    data: JSON.stringify(graphInfo),
                    success: function(response) {
                        if (response) {
                            //console.log(response);
                            graphInfo = response;
                            nodeTraversalAndPlacement(1);
                        }
                    },
                    error: function(error) {
                        console.log(error);
                    }
                });
            }
        }
    );

    // Extra Tools
    // Capture canvas as a PNG at current screen resolution
    // In future, 5 times the current resolution snapshot support will be provided
    $(snapshotCanvas).click(
        function(ev) {
            var img = holderCanvas.toDataURL("image/png");
            $('#capturedCanvasImage').html('<img src="' + img + '"/>');
    });
}


// ---------------------------------------------------------------------------------------

// Graph indexing, traversal, and state management code

function nodeTraversalAndPlacement(severity) {
    // Don't clear user generated data but clear all traversal related data
    resetStateVariables(severity);
    var nodesList = graphInfo.nodes;
    var edgesList = graphInfo.edges;

    // Build nodesIndexedById
    for (var i =0; i<nodesList.length; i++) {
        nodesIndexedById[nodesList[i].id] = nodesList[i];

        // Also check for root node during node iteration
        if (nodesList[i].name.toLowerCase() == "root" || nodesList[i].genus.toLowerCase() == "root") {
            rootNodeId = nodesList[i].id;
        }
    }

    // If no root node is found, assign the first node in nodesList as root node
    if (!rootNodeId) {
        if (nodesList.length) {
            rootNodeId = nodesList[0].id;
        }
    }

    // Build nodePropertiesIndexedById
    // This is built on a case by case basis, as and when required using addPropertyToNodePropertiesIndexedByIdObject()

    // Build mimimumY
    // mimimumY is built during traverse()

    // Build lastOrphanX
    // lastOrphanX is upated whenever an orphan is created

    // Build fromNodePathToNodes
    for (var i=0; i<edgesList.length; i++) {
        var tempEdge = edgesList[i];
        if (fromNodePathToNodes[tempEdge.fromNode]) {
            fromNodePathToNodes[tempEdge.fromNode].push(tempEdge.toNode);
        } else {
            fromNodePathToNodes[tempEdge.fromNode] = [];
            fromNodePathToNodes[tempEdge.fromNode].push(tempEdge.toNode);
        }
    }

    // Build edgesIndexedById
    for (var i=0; i<edgesList.length; i++) {
        edgesIndexedById[edgesList[i].id] = edgesList[i];
    }

    // Build traversalMapIndex
    // Will be build during traverse()

    // Now populate traversalLevels array
    // The following recursive function traverses the map and arranges node according to their level
    // as reachable by root node id
    if (rootNodeId) {
        // Graph assumed to originate from root
        // Cyclic traversals are also handled :)
        traverse('', rootNodeId, 0);
    }

    // Now assign X and Y coordinates for each of the nodes at a particular level
    (innerScopeFunctionHolder.buildXandYOrdinates)();

    // Now set the X, Y for orphaned nodes
    (innerScopeFunctionHolder.assignOrdinatesToOrphanNodes)();
}


// The following recursive function traverses the map and arranges node according to their level
function traverse(parentNodeId, nodeId, depth) {
    // Check if this path has been traversed before or not
    var traversalMapIndexKey = parentNodeId + '->' + nodeId;
    if (!(traversalMapIndex[traversalMapIndexKey] && traversalMapIndex[traversalMapIndexKey].traversalCount)) {
        // Add this traversal to the traversalMapIndex
        traversalMapIndex[traversalMapIndexKey] = {};
        traversalMapIndex[traversalMapIndexKey]['traversalCount'] = 1;

        if (!traversalLevels[depth]) {
            traversalLevels[depth] = [];
        }
        // First check if that nodeId is NOT already present at that level (through some other path)
        if (traversalLevels[depth].indexOf(nodeId) == -1) {
            traversalLevels[depth].push(nodeId);
        }
        // Now push child nodes in the recursive call and increase depth for the children to 1
        var newDepth = depth + 1;
        var childNodeIds = fromNodePathToNodes[nodeId];
        // Not every node may have a path from it
        if (Array.isArray(childNodeIds)) {
            for (var i=0; i<childNodeIds.length; i++) {
                traverse(nodeId, childNodeIds[i], newDepth);
            }
        }
    } else {
        // Log cyclic cycles detected!
        console.log('The path from parent: ' + nodesIndexedById[parentNodeId].name + 
            ' to child: ' + nodesIndexedById[nodeId].name + ' was found being traversed for the second time!');
        traversalMapIndex[traversalMapIndexKey].traversalCount++;
    }
}

function addPropertyToNodePropertiesIndexedByIdObject(nodeId, propertyKey, propertyValue) {
    if (nodePropertiesIndexedById.nodeId) {
        nodePropertiesIndexedById.nodeId[propertyKey] = propertyValue;
    } else {
        nodePropertiesIndexedById[nodeId] = {};
        nodePropertiesIndexedById.nodeId[propertyKey] = propertyValue;
    }
}

function findNodeUnderMousePointer(mouseX, mouseY, circleRadius) {
    // Find which node is the mouse hovering over
    // Return the node which is detected
    // Else return null
    var nodeFound = null;
    for (var nodeId in nodesIndexedById) {
        if (nodePropertiesIndexedById[nodeId] && 
            nodePropertiesIndexedById[nodeId].X && nodePropertiesIndexedById[nodeId].Y &&
            ( (Math.pow(circleRadius, 2)) >= 
                            (Math.pow((nodePropertiesIndexedById[nodeId].X - mouseX), 2) + 
                            Math.pow((nodePropertiesIndexedById[nodeId].Y - mouseY), 2)) )
            ) {
            return nodesIndexedById[nodeId];
        }
    }
    return nodeFound;
}

// ----------------------------------------------------------------------------------------------
// Graph Modification/Utility Operations

// Returns true on successful operation
// For pair wise operations, like linking nodes, nodeIdsClickSequence array is used
function performCircleClickOperation() {
    // Call either of below functinons

    
    if (isEditMode("editNode")) {
        if (nodeIdsClickSequence.length) {
            if (nodeIdsClickSequence.length == 1) {
                populateSideBar(null, nodeIdsClickSequence[nodeIdsClickSequence.length - 1]);
            } else {
                populateSideBar(nodeIdsClickSequence[nodeIdsClickSequence.length - 2], nodeIdsClickSequence[nodeIdsClickSequence.length - 1]);
            }
        }
    }

    // Mutually Exclusive Modes sorted by most reversible behaviour (through UI). Else If ensures only
    // one operation is executed
    if (isEditMode("addLink")) {
        if (nodeIdsClickSequence.length > 1) {
            // Add link between two past clicked nodes
            var fromNodeClickedId = nodeIdsClickSequence[nodeIdsClickSequence.length - 2];
            var toNodeClickedId = nodeIdsClickSequence[nodeIdsClickSequence.length - 1];
            addLink(fromNodeClickedId, toNodeClickedId);
        }
    } else if (isEditMode("removeLink")) {
        if (nodeIdsClickSequence.length > 1) {
            // Add link between two past clicked nodes
            var fromNodeClickedId = nodeIdsClickSequence[nodeIdsClickSequence.length - 2];
            var toNodeClickedId = nodeIdsClickSequence[nodeIdsClickSequence.length - 1];
            removeLink(fromNodeClickedId, toNodeClickedId);
        }
    } else if (isEditMode("addChild")) {
        if (nodeIdsClickSequence.length) {
            // Add a child to the node last clicked
            var nodeClickedId = nodeIdsClickSequence[nodeIdsClickSequence.length - 1];
            addChild(nodeClickedId);
        }
    }
}

function performCircleHoverOperation(nodeId) {
    if (isEditMode("highlightPath")) {
        innerScopeFunctionHolder.highlightPath(nodeId);
    }
}

// They are object manipulators only
// Don't confuse them with UI based operations
// UI operators take care of the UI changes on reading the objects manipulated by below functions

function addChild(nodeClickedId) {
    var newNodeId = generateANewIdForNode();
    // Add a new node to graph info
    graphInfo.nodes.push({
        "id": newNodeId,
        "name": "New Node",
        "genus": "New Genus",
        "graph": graphInfo.id
    });
    // Add a new edge to graph info
    graphInfo.edges.push({
        "id": generateANewIdForEdge(),
        "edgeProperties": [],
        "fromNode": nodeClickedId,
        "toNode": newNodeId,
        "graph": graphInfo.id
    });

    // Rebuild all indexes
    nodeTraversalAndPlacement();
}

function addLink(fromNodeId, toNodeId) {
    // Add Link follows a very strict set of rules to prevent cyclicity in graphs
    // Rules are mentioned as and when they appear in code

    // Rule 1
    // fromNodeId cannot be equal to toNodeId
    if (fromNodeId == toNodeId) {
        return;
    }

    // Rule 2
    // Link cannot be added from a node of higher depth to a node of lower or equal depth
    if (nodePropertiesIndexedById[fromNodeId].level >= nodePropertiesIndexedById[toNodeId].level) {
        return;
    }

    // Add a new edge to graph info
    graphInfo.edges.push({
        "id": generateANewIdForEdge(),
        "edgeProperties": [],
        "fromNode": fromNodeId,
        "toNode": toNodeId,
        "graph": graphInfo.id
    });

    // Rebuild all indexes
    nodeTraversalAndPlacement();

}

function removeLink(fromNodeId, toNodeId) {
    // Search for the index of the edge we want to remove
    var edgeIndex = -1;
    var edgesList = graphInfo.edges;
    for (var i=0; i<edgesList.length; i++) {
        if (edgesList[i].fromNode == fromNodeId && edgesList[i].toNode == toNodeId) {
            edgeIndex = i;
            break;
        }
    }

    if (edgeIndex > -1) {
        graphInfo.edges.splice(edgeIndex, 1);
    }

    // Rebuild all indexes
    nodeTraversalAndPlacement();
}

function removeNode(currentNodeId) {
    // Advanced Operation. Will be coded later on
}

function populateSideBar(fromNode, toNode) {
    sideBarData['toNodeId'] = toNode;
    sideBarData['toNode'] = nodesIndexedById[toNode].name;
    sideBarData['toNodeGenus'] = nodesIndexedById[toNode].genus;

    // Pre Handle possibly undefined values for template
    sideBarData['fromNodeId'] = null;

    if (fromNode) {
        // Find an edge, if fromNode is also specified
        var edgesList = graphInfo.edges;
        for (var i=0; i<edgesList.length; i++) {
            if (edgesList[i].fromNode == fromNode && edgesList[i].toNode == toNode) {
                sideBarData['fromNodeId'] = fromNode;
                sideBarData['fromNode'] = nodesIndexedById[fromNode].name;
                sideBarData['edgeAttributes'] = edgesList[i].edgeProperties;
                break;
            }
        }
    }
    renderTemplate('#nodeMetaData', '#nodeAttributesTemplate', sideBarData, 'overwrite');
}

$(addAttributeToEdge).click(function(ev) {
    // Add extra edge properties
});

function recoverDataFromSideBar() {
    if (sideBarData && sideBarData.toNodeId) {
        var newNodeName = $('.nodeAttributes #toNode').val();
        var newNodeGenus = $('.nodeAttributes #toNodeGenus').val();
        nodesIndexedById[sideBarData.toNodeId].name = newNodeName;
        nodesIndexedById[sideBarData.toNodeId].genus = newNodeGenus;

        // Now save the edge attributes
    }
}

function renderTemplate(holderDivDomSelector, templateDomSelector, data, mode) {
    var template = _.template($(templateDomSelector).html());
    console.log(JSON.stringify(data));
    console.log(template);
    if (mode == "append") {
        $(holderDivDomSelector).append(template(data));
    }
    if (mode == "overwrite") {
        $(holderDivDomSelector).html(template(data));
    }
}

function generateANewIdForNode() {
    // To generate a unique node, we can find the highest node id and increment it by 1

    // Traverse graphInfo (please don't use indexes for traversal for this)
    // Make an edgeId greater than the maximum
    var maximumNodeId = 0;
    var nodesList = graphInfo.nodes;
    for (var i=0; i<nodesList.length; i++) {
        if (nodesList[i].id > maximumNodeId) {
            maximumNodeId = nodesList[i].id;
        }
    }
    // Increment the maximumNodeId for new node
    maximumNodeId++;
    return maximumNodeId;
}

function generateANewIdForEdge() {
    // To generate a unique edge, we can find the highest edge id and increment it by 1

    // Traverse graphInfo (please don't use indexes for traversal for this)
    // Make an nodeId greater than the maximum
    var maximumEdgeId = 0;
    var edgesList = graphInfo.edges;
    for (var i=0; i<edgesList.length; i++) {
        if (edgesList[i].id > maximumEdgeId) {
            maximumEdgeId = edgesList[i].id;
        }
    }
    // Increment the maximumEdgeId for new edge
    maximumEdgeId++;
    return maximumEdgeId;
}