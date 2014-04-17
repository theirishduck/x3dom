/*
 * X3DOM JavaScript Library
 * http://www.x3dom.org
 *
 * (C)2009 Fraunhofer IGD, Darmstadt, Germany
 * Dual licensed under the MIT and GPL
 *
 * Based on code originally provided by
 * Philip Taylor: http://philip.html5.org
 */

/* ### Polyline2D ### */
x3dom.registerNodeType(
    "Polyline2D",
    "Geometry2D",
    defineClass(x3dom.nodeTypes.X3DPlanarGeometryNode,
        function (ctx) {
            x3dom.nodeTypes.Polyline2D.superClass.call(this, ctx);

            this.addField_MFVec2f(ctx, 'lineSegments', []);

            this._mesh._primType = 'LINES';

            var x = 0, y = 0;
            if (this._vf.lineSegments.length) {
                x = this._vf.lineSegments[0].x;
                y = this._vf.lineSegments[0].y;
            }

            var geoCacheID = 'Polyline2D_' + x + '-' + y;

            if (this._vf.useGeoCache && x3dom.geoCache[geoCacheID] !== undefined) {
                //x3dom.debug.logInfo("Using Polyline2D from Cache");
                this._mesh = x3dom.geoCache[geoCacheID];
            }
            else {
                for (var i = 0; i < this._vf.lineSegments.length; i++) {
                    x = this._vf.lineSegments[i].x;
                    y = this._vf.lineSegments[i].y;
                    this._mesh._positions[0].push(x);
                    this._mesh._positions[0].push(y);
                    this._mesh._positions[0].push(0.0);
                }
                for (var j = 0; j < this._vf.lineSegments.length - 1; j++) {
                    this._mesh._indices[0].push(j);
                    this._mesh._indices[0].push(j + 1);
                }

                this._mesh._invalidate = true;
                this._mesh._numFaces = this._mesh._indices[0].length / 2;
                this._mesh._numCoords = this._mesh._positions[0].length / 3;

                x3dom.geoCache[geoCacheID] = this._mesh;
            }
        },
        {
            fieldChanged: function (fieldName) {
                if (fieldName == "lineSegments") {
                    var x, y;
                    this._mesh._positions[0] = [];
                    this._mesh._indices[0] = [];
                    for (var i = 0; i < this._vf.lineSegments.length; i++) {
                        x = this._vf.lineSegments[i].x;
                        y = this._vf.lineSegments[i].y;
                        this._mesh._positions[0].push(x);
                        this._mesh._positions[0].push(y);
                        this._mesh._positions[0].push(0.0);
                    }
                    for (var j = 0; j < this._vf.lineSegments.length - 1; j++) {
                        this._mesh._indices[0].push(j);
                        this._mesh._indices[0].push(j + 1);
                    }

                    this.invalidateVolume();
                    this._mesh._numFaces = this._mesh._indices[0].length / 2;
                    this._mesh._numCoords = this._mesh._positions[0].length / 3;

                    Array.forEach(this._parentNodes, function (node) {
                        node._dirty.positions = true;
                        node._dirty.indexes = true;
                        node.invalidateVolume();
                    });
                }
            }
        }
    )
);