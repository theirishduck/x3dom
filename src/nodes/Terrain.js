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

// ### Terrain ###
x3dom.registerNodeType(
    "Terrain",
    "Navigation",
    defineClass(x3dom.nodeTypes.X3DLODNode,
        function (ctx) {
            x3dom.nodeTypes.Terrain.superClass.call(this, ctx);

            this.addField_SFFloat(ctx, 'factor', 1.0);
            this.addField_SFInt32(ctx, 'maxDepth', 3);
            this.addField_SFVec2f(ctx, 'size', 1, 1);
            this.addField_SFVec2f(ctx, 'subdivision', 10, 10);
            this.addField_SFString(ctx, 'url', "");
            this.addField_SFString(ctx, 'elevationUrl', "");
            this.addField_SFString(ctx, 'textureUrl', "");
            this.addField_SFString(ctx, 'mode', "");
            this.addField_SFString(ctx, 'imageFormat', "png");
            this.addField_SFFloat(ctx, 'maxElevation', 1.0);

            if (this._vf.mode === "bin") {
                // creating the root-node of the quadtree
                this.rootNode = new QuadtreeNodeBin(ctx, this, 0, 0, 0);
            }
            else if (this._vf.mode === "3d" || this._vf.mode === "2d") {
                // 2D-Mesh that will represent the geometry of this node
                var geometry = new x3dom.nodeTypes.Plane(ctx);
                // definition the parameters of the geometry
                geometry._vf.subdivision.setValues(this._vf.subdivision);
                geometry.fieldChanged("subdivision");
                geometry._vf.size.setValues(this._vf.size);
                geometry._vf.center.setValues(this._vf.center);
                
                if (this._vf.mode === "2d") {
                    // creating the root-node of the quadtree
                    this.rootNode = new QuadtreeNode2D(ctx, this, 0, 0,
                                                       new x3dom.fields.SFMatrix4f.identity(), 
                                                       0, 0, geometry);
                }
                else {
                    this.rootNode = new QuadtreeNode3D(ctx, this, 0, 0,
                                                       new x3dom.fields.SFMatrix4f.identity(), 
                                                       0, 0, geometry);
                }
            }
            else {
                x3dom.debug.logError("Error attribute mode. Value: '" + this._vf.mode +
                                     "' isn't conform. Please use type 'bin', '2d' or '3d'");
            }
        },
        {
            visitChildren: function(transform, drawableCollection, singlePath, invalidateCache) {
                this.createChildren = 0;
                singlePath = false;         // TODO (specify if unique node path or multi-parent)
                invalidateCache = true;     // TODO (reuse world transform and volume cache)
                this.rootNode.collectDrawables(transform, drawableCollection, singlePath, invalidateCache);
            },

            getVolume: function()
            {
                var vol = this._graph.volume;

                if (!this.volumeValid() && this._vf.render)
                {
                    var childVol = this.rootNode.getVolume();
                    if (childVol && childVol.isValid())
                        vol.extendBounds(childVol.min, childVol.max);
                }

                return vol;
            }
        }
    )
);



/*
 * Defines one node of a quadtree that represents a part (nxn vertices) of the whole mesh.
 */
function QuadtreeNode2D(ctx, navigation, level, nodeNumber, nodeTransformation, 
                        columnNr, rowNr, geometry)
{

     // array with the maximal four child nodes
    var children = [];
    // drawable component of this node
    var shape = new x3dom.nodeTypes.Shape();
    // position of the node in world space
    var position = null;
    // true if components are available and renderable
    var isPossible = true;
    // url of the data source
    var url = navigation._vf.url + "/" + level + "/" + columnNr + 
              "/" + rowNr + "." + (navigation._vf.imageFormat).toLowerCase();
    // defines the resizing factor
    var resizeFac = (navigation._vf.size.x + navigation._vf.size.y) / 2.0;
    var fac = navigation._vf.factor + Math.pow(3, level);
    if (fac > 120){ fac = 120; }  
    
    
    
    function initialize() {

        // appearance of the drawable component of this node
        var appearance = new x3dom.nodeTypes.Appearance(ctx);
        // texture that should represent the surface-data of this node
        var texture = new x3dom.nodeTypes.ImageTexture(ctx);

        // definition of the nameSpace of this shape
        shape._nameSpace = navigation._nameSpace;
        
        texture._nameSpace = navigation._nameSpace;
        texture._vf.url[0] = url;

        // calculate the average position of the node
        position = nodeTransformation.e3();
        
        // add textures to the appearence of this node
        appearance.addChild(texture);
        texture.nodeChanged();

        // create shape with geometry and appearance data
        shape._cf.geometry.node = geometry;
        shape._cf.appearance.node = appearance;
        geometry.nodeChanged();
        appearance.nodeChanged();

        navigation.addChild(shape);
        shape.nodeChanged();
    }
    
    
    
    // creates the four child-nodes
    function create() {

        // CREATE ALL FOUR CHILDREN
        var deltaR = Math.sqrt(Math.pow(4, level));
        var deltaR1 = Math.sqrt(Math.pow(4, level + 1));
        var lt = Math.floor(nodeNumber / deltaR) * 4 * deltaR + 
                           (nodeNumber % deltaR) * 2;
        var rt = lt + 1;
        var lb = lt + deltaR1;
        var rb = lb + 1;
        var s = (navigation._vf.size).multiply(0.25);

        children.push(new QuadtreeNode2D(ctx, navigation, (level + 1), lt,
            nodeTransformation.mult(new x3dom.fields.SFMatrix4f.translation(
                    new x3dom.fields.SFVec3f(-s.x, s.y, 0.0))).mult(new x3dom.fields.SFMatrix4f.scale(
                    new x3dom.fields.SFVec3f(0.5, 0.5, 1.0))), (columnNr * 2), (rowNr * 2), geometry));
        children.push(new QuadtreeNode2D(ctx, navigation, (level + 1), rt,
            nodeTransformation.mult(new x3dom.fields.SFMatrix4f.translation(
                    new x3dom.fields.SFVec3f(s.x, s.y, 0.0))).mult(new x3dom.fields.SFMatrix4f.scale(
                    new x3dom.fields.SFVec3f(0.5, 0.5, 1.0))), (columnNr * 2 + 1), (rowNr * 2), geometry));
        children.push(new QuadtreeNode2D(ctx, navigation, (level + 1), lb,
            nodeTransformation.mult(new x3dom.fields.SFMatrix4f.translation(
                    new x3dom.fields.SFVec3f(-s.x, -s.y, 0.0))).mult(new x3dom.fields.SFMatrix4f.scale(
                    new x3dom.fields.SFVec3f(0.5, 0.5, 1.0))), (columnNr * 2), (rowNr * 2 + 1), geometry));
        children.push(new QuadtreeNode2D(ctx, navigation, (level + 1), rb,
            nodeTransformation.mult(new x3dom.fields.SFMatrix4f.translation(
                    new x3dom.fields.SFVec3f(s.x, -s.y, 0.0))).mult(new x3dom.fields.SFMatrix4f.scale(
                    new x3dom.fields.SFVec3f(0.5, 0.5, 1.0))), (columnNr * 2 + 1), (rowNr * 2 + 1), geometry));
    }
    
    
    
    
    // here the decision is taken if new children should be created
    // and which should be rendered
    this.collectDrawables = function (transform, drawableCollection, singlePath, invalidateCache) {

        if (isPossible) {
            var mat_view = drawableCollection.viewMatrix;
            var vPos = mat_view.multMatrixPnt(position);
            var distanceToCamera = Math.sqrt(Math.pow(vPos.x, 2) + Math.pow(vPos.y, 2) + Math.pow(vPos.z, 2));
            if ((distanceToCamera < Math.pow((navigation._vf.maxDepth - level), 2) * resizeFac / fac)) {
                if (children.length === 0 && navigation.createChildren === 0) {
                    navigation.createChildren++;
                    create();
                }
                else if (children.length === 0 && navigation.createChildren > 0) {
                    shape.collectDrawableObjects(nodeTransformation, drawableCollection, singlePath, invalidateCache);
                }
                else {
                    for (var i = 0; i < children.length; i++) {
                        children[i].collectDrawables(nodeTransformation, drawableCollection, singlePath, invalidateCache);
                    }
                }
            }
            else {
                shape.collectDrawableObjects(nodeTransformation, drawableCollection, singlePath, invalidateCache);
            }
        }
    };

    this.getVolume = function() {
        // TODO; implement correctly, for now just use first shape as workaround
        return shape.getVolume();
    };

    // initializes this node directly after creating
    initialize();
}




/*
 * Defines one node of a quadtree that represents a part (nxn vertices) of the whole mesh.
 */
function QuadtreeNode3D(ctx, navigation, level, nodeNumber, nodeTransformation, 
                        columnNr, rowNr, geometry)
{
    // array with the maximal four child nodes
    var children = [];
    // drawable component of this node
    var shape = new x3dom.nodeTypes.Shape();
    // position of the node in world space
    var position = null;
    // address of the image for the terrain surface
    var imageAddressColor = navigation._vf.textureUrl + "/" + level + "/" + 
                            columnNr + "/" + rowNr + "." + 
                            (navigation._vf.imageFormat).toLowerCase();
    // address of the image for the terrain height-data
    var imageAddressHeight = navigation._vf.elevationUrl + "/" + level + "/" + 
                             columnNr + "/" + rowNr + "." + 
                             (navigation._vf.imageFormat).toLowerCase();
    // true if components are available and renderable
    var isPossible = true;
    // defines the resizing factor
    var resizeFac = (navigation._vf.size.x + navigation._vf.size.y) / 2.0;
    var fac = navigation._vf.factor + Math.pow(3, level);
    if (fac > 120){ fac = 120; }


    function initialize() {

        // appearance of the drawable component of this node
        var appearance = new x3dom.nodeTypes.Appearance(ctx);
        // multiTexture to get heightmap and colormap to gpu
        var textures = new x3dom.nodeTypes.MultiTexture(ctx);
        // texture that should represent the surface-data of this node
        var colorTexture = new x3dom.nodeTypes.ImageTexture(ctx);
        // texture that should represent the height-data of this node
        var heightTexture = new x3dom.nodeTypes.ImageTexture(ctx);
        // creating the special shader for these nodes
        var composedShader = new x3dom.nodeTypes.ComposedShader(ctx);

        // definition of the nameSpace of this shape
        shape._nameSpace = navigation._nameSpace;

        // calculate the average position of the node
        position = nodeTransformation.e3();
        
        // creating the special vertex-shader for terrain-nodes
        var vertexShader = new x3dom.nodeTypes.ShaderPart(ctx);
        vertexShader._vf.type = 'vertex';
        vertexShader._vf.url[0] = createVertexShader();

        // creating the special fragment-shader for terrain-nodes
        var fragmentShader = new x3dom.nodeTypes.ShaderPart(ctx);
        fragmentShader._vf.type = 'fragment';
        fragmentShader._vf.url[0] = createFragmentShader();

        // create complete-shader with vertex- and fragment-shader
        composedShader.addChild(vertexShader, 'parts');
        composedShader.addChild(fragmentShader, 'parts');

        // create texture-data of this node with url's of the texture data
        colorTexture._nameSpace = navigation._nameSpace;
        colorTexture._vf.url[0] = imageAddressColor;
        colorTexture._vf.repeatT = false;
        colorTexture._vf.repeatS = false;
        textures.addChild(colorTexture, 'texture');
        colorTexture.nodeChanged();
        var colorTextureField = new x3dom.nodeTypes.Field(ctx);
        colorTextureField._vf.name = 'texColor';
        colorTextureField._vf.type = 'SFInt32';
        colorTextureField._vf.value = 0;
        composedShader.addChild(colorTextureField, 'fields');
        colorTextureField.nodeChanged();

        // create height-data
        heightTexture._nameSpace = navigation._nameSpace;
        heightTexture._vf.url[0] = imageAddressHeight;
        heightTexture._vf.repeatT = false;
        heightTexture._vf.repeatS = false;
        textures.addChild(heightTexture, 'texture');
        heightTexture.nodeChanged();
        var heightTextureField = new x3dom.nodeTypes.Field(ctx);
        heightTextureField._vf.name = 'texHeight';
        heightTextureField._vf.type = 'SFInt32';
        heightTextureField._vf.value = 1;
        composedShader.addChild(heightTextureField, 'fields');
        heightTextureField.nodeChanged();
        
        // transmit maximum elevation value to gpu
        var maxHeight = new x3dom.nodeTypes.Field(ctx);
        maxHeight._vf.name = 'maxElevation';
        maxHeight._vf.type = 'SFFloat';
        maxHeight._vf.value = navigation._vf.maxElevation;
        composedShader.addChild(maxHeight, 'fields');
        maxHeight.nodeChanged();

        // add textures to the appearence of this node
        appearance.addChild(textures);
        textures.nodeChanged();
        appearance.addChild(composedShader);
        composedShader.nodeChanged();

        // create shape with geometry and appearance data
        shape._cf.geometry.node = geometry;
        shape._cf.appearance.node = appearance;
        geometry.nodeChanged();
        appearance.nodeChanged();

        navigation.addChild(shape);
        shape.nodeChanged();
    }



    function createVertexShader() {
        return "attribute vec3 position;\n" +
            "attribute vec3 texcoord;\n" +
            "uniform mat4 modelViewProjectionMatrix;\n" +
            "uniform sampler2D texHeight;\n" +
            "uniform float maxElevation;\n" +
            "varying vec3 col;\n" +
            "varying vec2 texC;\n" +
            "\n" +
            "void main(void) {\n" +
            "    vec4 height = texture2D(texHeight, vec2(texcoord[0], 1.0 - texcoord[1]));\n" +
            "    texC = vec2(texcoord[0], 1.0-texcoord[1]);\n" +
            "    col = vec3(height[0], height[1], height[2]);\n" +
            "    gl_Position = modelViewProjectionMatrix * vec4(position.xy, height.x * maxElevation, 1.0);\n" +
            "}\n";
    }



    function createFragmentShader() {
        return "#ifdef GL_ES\n" +
            "  precision highp float;\n" +
            "#endif\n" +
            "uniform sampler2D texColor;\n" +
            "varying vec2 texC;\n" +
            "varying vec3 col;\n" +
            "\n" +
            "\n" +
            "void main(void) {\n" +
            "    vec4 colr = texture2D(texColor, texC);\n" +
            "    gl_FragColor = vec4(colr.xyz, 1.0);\n" +
            "}\n";
    }



    // creates the four child-nodes
    function create() {

        // CREATE ALL FOUR CHILDREN
        var deltaR = Math.sqrt(Math.pow(4, level));
        var deltaR1 = Math.sqrt(Math.pow(4, level + 1));
        var lt = Math.floor(nodeNumber / deltaR) * 4 * deltaR + 
                           (nodeNumber % deltaR) * 2;
        var rt = lt + 1;
        var lb = lt + deltaR1;
        var rb = lb + 1;
        var s = (navigation._vf.size).multiply(0.25);

        children.push(new QuadtreeNode3D(ctx, navigation, (level + 1), lt,
            nodeTransformation.mult(new x3dom.fields.SFMatrix4f.translation(
                    new x3dom.fields.SFVec3f(-s.x, s.y, 0.0))).mult(new x3dom.fields.SFMatrix4f.scale(
                    new x3dom.fields.SFVec3f(0.5, 0.5, 1.0))), (columnNr * 2), (rowNr * 2), geometry));
        children.push(new QuadtreeNode3D(ctx, navigation, (level + 1), rt,
            nodeTransformation.mult(new x3dom.fields.SFMatrix4f.translation(
                    new x3dom.fields.SFVec3f(s.x, s.y, 0.0))).mult(new x3dom.fields.SFMatrix4f.scale(
                    new x3dom.fields.SFVec3f(0.5, 0.5, 1.0))), (columnNr * 2 + 1), (rowNr * 2), geometry));
        children.push(new QuadtreeNode3D(ctx, navigation, (level + 1), lb,
            nodeTransformation.mult(new x3dom.fields.SFMatrix4f.translation(
                    new x3dom.fields.SFVec3f(-s.x, -s.y, 0.0))).mult(new x3dom.fields.SFMatrix4f.scale(
                    new x3dom.fields.SFVec3f(0.5, 0.5, 1.0))), (columnNr * 2), (rowNr * 2 + 1), geometry));
        children.push(new QuadtreeNode3D(ctx, navigation, (level + 1), rb,
            nodeTransformation.mult(new x3dom.fields.SFMatrix4f.translation(
                    new x3dom.fields.SFVec3f(s.x, -s.y, 0.0))).mult(new x3dom.fields.SFMatrix4f.scale(
                    new x3dom.fields.SFVec3f(0.5, 0.5, 1.0))), (columnNr * 2 + 1), (rowNr * 2 + 1), geometry));
    }



    // here the decision is taken if new children should be created
    // and which should be rendered
    this.collectDrawables = function (transform, drawableCollection, singlePath, invalidateCache) {

        if (isPossible) {
            var mat_view = drawableCollection.viewMatrix;
            var vPos = mat_view.multMatrixPnt(position);
            var distanceToCamera = Math.sqrt(Math.pow(vPos.x, 2) + Math.pow(vPos.y, 2) + Math.pow(vPos.z, 2));
            if ((distanceToCamera < Math.pow((navigation._vf.maxDepth - level), 2) * resizeFac / fac)) {
                if (children.length === 0 && navigation.createChildren === 0) {
                    navigation.createChildren++;
                    create();
                    shape.collectDrawableObjects(nodeTransformation, drawableCollection, singlePath, invalidateCache);
                }
                else if (children.length === 0 && navigation.createChildren > 0) {
                    shape.collectDrawableObjects(nodeTransformation, drawableCollection, singlePath, invalidateCache);
                }
                else {
                    for (var i = 0; i < children.length; i++) {
                        children[i].collectDrawables(nodeTransformation, drawableCollection, singlePath, invalidateCache);
                    }
                }
            }
            else {
                shape.collectDrawableObjects(nodeTransformation, drawableCollection, singlePath, invalidateCache);
            }
        }
    };

    this.getVolume = function() {
        // TODO; implement correctly, for now just use first shape as workaround
        return shape.getVolume();
    };

    // initializes this node directly after creating
    initialize();
}



/*
 * Defines one node of a quadtree that represents a part (nxn vertices) of 
 * the whole mesh, that represents a binary geometry object.
 */
function QuadtreeNodeBin(ctx, navigation, level, columnNr, rowNr)
{
    var fac = navigation._vf.factor + Math.pow(3, level);
    if (fac > 120){ fac = 120; }
    // array with the maximal four child nodes
    var children = [];
    // path to x3d-file that should be loaded
    var path = navigation._vf.url + "/" + level + "/" + columnNr + "/";
    // address of the image for the terrain height-data
    var file = path + rowNr + ".x3d";
    // position of the node in world space
    var position = null;
    // stores if file has been loaded
    var exists = false;
    // drawable component of this node
    var shape = new x3dom.nodeTypes.Shape(ctx);
    // loader for binary geometry files
    var xhr = new XMLHttpRequest();
    xhr.open("GET", file, false);
    // Try to load the binary geometry files
    try {
        xhr.send();

        var xmlDoc = xhr.responseXML;
        if (xmlDoc !== null) {
            var replacer = new RegExp("\"", "g");
            createGeometry(shape);
            initialize();
            exists = true;
        }
        var imgAddress = xmlDoc.getElementsByTagName("ImageTexture")[0].
                            getAttribute("url").replace(replacer, "");
    }
    catch (exp) {
        x3dom.debug.logException("Error loading file '" + file + "': " + exp);
    }



    /*
     * creates the geometry of this node
     */
    function createGeometry(parent) {
        var binGeo = xmlDoc.getElementsByTagName("BinaryGeometry")[0];

        if (parent && parent._nameSpace && binGeo) {
            var geometry = parent._nameSpace.setupTree(binGeo);
            parent.addChild(geometry);
            geometry.nodeChanged();

            position = x3dom.fields.SFVec3f.copy(geometry._vf.position);
        }
    }



    /*
     * creates the appearance for this node and add it to the dom tree
     */
    function initialize() {

        // appearance of the drawable component of this node
        var appearance = new x3dom.nodeTypes.Appearance(ctx);
        // multiTexture to get heightmap and colormap to gpu
        var textures = new x3dom.nodeTypes.MultiTexture(ctx);
        // texture that should represent the surface-data of this node
        var colorTexture = new x3dom.nodeTypes.ImageTexture(ctx);
        // texture that should represent the height-data of this node
        // var heightTexture = new x3dom.nodeTypes.ImageTexture(ctx);

        shape._nameSpace = new x3dom.NodeNameSpace("", navigation._nameSpace.doc);
        shape._nameSpace.setBaseURL(navigation._nameSpace.baseURL + path);

        colorTexture._nameSpace = shape._nameSpace;
        colorTexture._vf.url[0] = imgAddress;
        colorTexture._vf.repeatT = false;
        colorTexture._vf.repeatS = false;
        textures.addChild(colorTexture, 'texture');
        colorTexture.nodeChanged();

        appearance.addChild(textures);
        textures.nodeChanged();
        shape.addChild(appearance);
        appearance.nodeChanged();
        shape.nodeChanged();
    }



    /*
     * creates the four child-nodes
     */
    function create() {
        children.push(new QuadtreeNodeBin(ctx, navigation, (level + 1), (columnNr * 2), (rowNr * 2)));
        children.push(new QuadtreeNodeBin(ctx, navigation, (level + 1), (columnNr * 2 + 1), (rowNr * 2)));
        children.push(new QuadtreeNodeBin(ctx, navigation, (level + 1), (columnNr * 2), (rowNr * 2 + 1)));
        children.push(new QuadtreeNodeBin(ctx, navigation, (level + 1), (columnNr * 2 + 1), (rowNr * 2 + 1)));
    }



    /*
     * here the decision is taken if new children should be created
     * and which should be rendered
     */
    this.collectDrawables = function (transform, drawableCollection, singlePath, invalidateCache) {

        if (exists) {
            var mat_view = drawableCollection.viewMatrix;
                
            var center = new x3dom.fields.SFVec3f(0, 0, 0); // eye
            center = mat_view.inverse().multMatrixPnt(center);
            
            //var mat_view_model = mat_view.mult(transform);
            navigation._eye = transform.inverse().multMatrixPnt(center);
            
            var distanceToCamera = position.subtract(navigation._eye).length();
            // navigation._vf.factor instead (level * 16)
            if ((distanceToCamera < Math.pow((navigation._vf.maxDepth - level), 2) * 1700 / fac)) {
                if (children.length === 0 && navigation.createChildren <= 1) {
                    navigation.createChildren++;
                    create();
                    shape.collectDrawableObjects(transform, drawableCollection, singlePath, invalidateCache);
                }
                else if (children.length === 0 && navigation.createChildren > 1) {
                    shape.collectDrawableObjects(transform, drawableCollection, singlePath, invalidateCache);
                }
                else {
                    for (var i = 0; i < children.length; i++) {
                        children[i].collectDrawables(transform, drawableCollection, singlePath, invalidateCache);
                    }
                }
            }
            else {
                shape.collectDrawableObjects(transform, drawableCollection, singlePath, invalidateCache);
            }
        }
    };



    /*
     * Returns the volume of this node
     */
    this.getVolume = function() {
        // TODO; implement correctly, for now just use first shape as workaround
        return shape.getVolume();
    };



    // initializes this node directly after creating
    initialize();
}

