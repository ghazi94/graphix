var holderCanvas = document.getElementById("holderCanvas");
//var innerCanvas = document.getElementById("innerCanvas");

//var gkhead = new Image;

window.onload = function() {

    window.outerCtx = holderCanvas.getContext('2d');
    //var innerCtx = holderCanvas.getContext('2d');

    trackTransforms(outerCtx);

    function redraw() {

        // Clear the entire holderCanvas
        var p1 = outerCtx.transformedPoint(0, 0);
        var p2 = outerCtx.transformedPoint(holderCanvas.width, holderCanvas.height);
        outerCtx.clearRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);

        outerCtx.save();
        outerCtx.setTransform(1, 0, 0, 1, 0, 0);
        outerCtx.clearRect(0, 0, holderCanvas.width, holderCanvas.height);
        outerCtx.restore();
    }

    redraw();

    var lastX = holderCanvas.width / 2,
        lastY = holderCanvas.height / 2;

    var dragStart, dragged;

    holderCanvas.addEventListener('mousedown', function(evt) {
        document.body.style.mozUserSelect = document.body.style.webkitUserSelect = document.body.style.userSelect = 'none';
        lastX = evt.offsetX || (evt.pageX - holderCanvas.offsetLeft);
        lastY = evt.offsetY || (evt.pageY - holderCanvas.offsetTop);
        dragStart = outerCtx.transformedPoint(lastX, lastY);
        dragged = false;
    }, false);

    holderCanvas.addEventListener('mousemove', function(evt) {
        lastX = evt.offsetX || (evt.pageX - holderCanvas.offsetLeft);
        lastY = evt.offsetY || (evt.pageY - holderCanvas.offsetTop);
        dragged = true;
        if (dragStart) {
            var pt = outerCtx.transformedPoint(lastX, lastY);
            outerCtx.translate(pt.x - dragStart.x, pt.y - dragStart.y);
            redraw();
        }
    }, false);

    holderCanvas.addEventListener('mouseup', function(evt) {
        dragStart = null;
        // Zoom a bit on click
        //if (!dragged) zoom(evt.shiftKey ? -1 : 1);
    }, false);

    var scaleFactor = 1.1;

    var zoom = function(clicks) {
        var pt = outerCtx.transformedPoint(lastX, lastY);
        outerCtx.translate(pt.x, pt.y);
        var factor = Math.pow(scaleFactor, clicks);
        outerCtx.scale(factor, factor);
        outerCtx.translate(-pt.x, -pt.y);
        redraw();
    }

    var handleScroll = function(evt) {
        var delta = evt.wheelDelta ? evt.wheelDelta / 100 : evt.detail ? -evt.detail : 0;
        if (delta) zoom(delta);
        return evt.preventDefault() && false;
    };

    holderCanvas.addEventListener('DOMMouseScroll', handleScroll, false);
    holderCanvas.addEventListener('mousewheel', handleScroll, false);
};

//gkhead.src = 'photocc.png';

// Adds outerCtx.getTransform() - returns an SVGMatrix
// Adds outerCtx.transformedPoint(x,y) - returns an SVGPoint
function trackTransforms(outerCtx) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
    var xform = svg.createSVGMatrix();
    outerCtx.getTransform = function() {
        return xform;
    };

    var savedTransforms = [];
    var save = outerCtx.save;
    outerCtx.save = function() {
        savedTransforms.push(xform.translate(0, 0));
        return save.call(outerCtx);
    };

    var restore = outerCtx.restore;
    outerCtx.restore = function() {
        xform = savedTransforms.pop();
        return restore.call(outerCtx);
    };

    var scale = outerCtx.scale;
    outerCtx.scale = function(sx, sy) {
        xform = xform.scaleNonUniform(sx, sy);
        return scale.call(outerCtx, sx, sy);
    };

    var rotate = outerCtx.rotate;
    outerCtx.rotate = function(radians) {
        xform = xform.rotate(radians * 180 / Math.PI);
        return rotate.call(outerCtx, radians);
    };

    var translate = outerCtx.translate;
    outerCtx.translate = function(dx, dy) {
        xform = xform.translate(dx, dy);
        return translate.call(outerCtx, dx, dy);
    };

    var transform = outerCtx.transform;
    outerCtx.transform = function(a, b, c, d, e, f) {
        var m2 = svg.createSVGMatrix();
        m2.a = a;
        m2.b = b;
        m2.c = c;
        m2.d = d;
        m2.e = e;
        m2.f = f;
        xform = xform.multiply(m2);
        return transform.call(outerCtx, a, b, c, d, e, f);
    };

    var setTransform = outerCtx.setTransform;
    outerCtx.setTransform = function(a, b, c, d, e, f) {
        xform.a = a;
        xform.b = b;
        xform.c = c;
        xform.d = d;
        xform.e = e;
        xform.f = f;
        return setTransform.call(outerCtx, a, b, c, d, e, f);
    };

    var pt = svg.createSVGPoint();
    outerCtx.transformedPoint = function(x, y) {
        pt.x = x;
        pt.y = y;
        return pt.matrixTransform(xform.inverse());
    }
}

function transformGraphOrdinates(graph, outerCtx) {
    // Scan all the nodes to find which node circle is under the mouse
    if (graph.node && graph.node.X && graph.node.Y) {
        var newPoint = outerCtx.transformedPoint();
        
        // Find children and transform their ordinates too
        if (Array.isArray(graph.node.children)) {
            for (var i=0; i<graph.node.children.length; i++) {
                transformGraphOrdinates(graph.node.children[i], outerCtx);
            }
        }
    }
}