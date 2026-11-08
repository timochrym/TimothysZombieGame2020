class CollisionDetector {

    static collision(objects, objectToTest, xyAdd) {

        //All Points of All Objects
        this.allObjectsPoints = []

        //Collide is False UNLESS TRUE
        this.collide = false
        this.objectCollidedWith = null

        //Compare All Edges to objectToTest's Edges

        //For Every Object...
        for (let activeObject = 0; activeObject < objects.length; activeObject++) {
            this.activeObject = objects[activeObject]

            //Except Itself,
            if (this.activeObject != objectToTest) {

                //For Every Edge in ObjectToTest
                for (let edgeCounter = 0; edgeCounter < objectToTest.edgeRetrieve().length; edgeCounter++) {
                    this.objectToTestEdge = objectToTest.edgeRetrieve()[edgeCounter]

                    //Adding xyAdd To objectToTest's Edges
                    for (let i = 0; i < this.objectToTestEdge.length; i++) {
                        this.objectToTestEdge[i][0] += xyAdd[0]
                        this.objectToTestEdge[i][1] += xyAdd[1]
                    }

                    //For Every Edge in activeObject
                    for (let edgeCounter = 0; edgeCounter < this.activeObject.edgeRetrieve().length; edgeCounter++) {
                        this.activeObjectEdge = this.activeObject.edgeRetrieve()[edgeCounter]

                        //Adding activeObject's Speed To its Edges
                        for (let i = 0; i < this.activeObject.length; i++) {
                            this.activeObject[i][0] += activeObject.xspeed
                            this.activeObject[i][1] += activeObject.yspeed
                        }

                        //Test if this.activeObject's Edges Overlap with objectToTest
                        if (this.overlap(this.objectToTestEdge, this.activeObjectEdge) == true) {
                            this.collide = true
                            this.objectCollidedWith = activeObject

                            return [this.collide, this.activeObject]
                        }
                    }
                }

                //Cheap Hack to get Prediction for OBT movement
                this.objectToTest = []
                for (let i = 0; i < objectToTest.points.length; i++) {
                    this.p1 = i
                    if (i + 1 >= objectToTest.points.length) {
                        this.p2 = i + 1 - objectToTest.points.length
                    } else {
                        this.p2 = i + 1
                    }
                    this.objectToTest.push([
                        [objectToTest.points[this.p1][0] + xyAdd[0],
                            objectToTest.points[this.p1][1] + xyAdd[1]
                        ],
                        [objectToTest.points[this.p2][0] + xyAdd[0],
                            objectToTest.points[this.p2][1] + xyAdd[1]
                        ]
                    ])
                }
                //Change EdgeRetrieve to ()
                if (this.inBewteen(this.objectToTest, this.activeObject.edgeRetrieve()) == true) {
                    this.collide = true
                    this.objectCollidedWith = activeObject
                }
            }
        }
        return [this.collide, null]
    }

    static inBewteen(objectToTestEdges, activeObjectEdges) {

        //Find X Ranges of Both Objects
        this.xRange1 = [objectToTestEdges[0][0][0], objectToTestEdges[0][1][0]]
        this.xRange2 = [activeObjectEdges[0][0][0], activeObjectEdges[0][1][0]]

        //Find Y Ranges of Both Objects
        this.yRange1 = [objectToTestEdges[1][0][1], objectToTestEdges[1][1][1]]
        this.yRange2 = [activeObjectEdges[1][0][1], activeObjectEdges[1][1][1]]

        //Detect if Both X and Y Ranges are crossed
        if (this.gridOverlap(this.xRange1, this.xRange2) && this.gridOverlap(this.yRange1, this.yRange2)) {
            console.log("yay")
            return true
        }
    }

    static gridOverlap(range1, range2) {

        //Organize Ranges to Start From The Smaller Number
        range1.sort()
        range2.sort()

        //Tests if Points Along Both Ranges Overlap
        if (range1[0] > range2[0] && range1[0] < range2[1]) {
            return true
        } else if (range2[0] > range1[0] && range2[0] < range1[1]) {
            return true
        }
    }

    static overlap(edge1, edge2, objectToTest, activeObject) {

        //Finds Slopes Without Y Offset
        this.slope1 = (edge1[0][1] - edge1[1][1]) / (edge1[0][0] - edge1[1][0])
        this.slope2 = (edge2[0][1] - edge2[1][1]) / (edge2[0][0] - edge2[1][0])

        //Finds Slope
        this.slope1Yoff = edge1[0][1] - (this.slope1 * edge1[0][0])
        this.slope2Yoff = edge2[0][1] - (this.slope2 * edge2[0][0])

        //Finds X Intercept UNLESS IMPOSSIBLE
        if (this.slope1 != this.slope2) {
            this.xIntercept = (this.slope1Yoff - this.slope2Yoff) / (this.slope1 - this.slope2) * -1

            //Checks if X Intercept is on Segment
            if (this.xIntercept >= edge1[0][0] && this.xIntercept <= edge1[1][0]) {
                return true
            }
        }

        //If Everything is False:
        return false

    }
}