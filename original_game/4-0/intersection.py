edge1 = [[-10,2],[500, 87]]
edge2 = [[40,2],[8, -4]]


slope1 = (edge1[0][1]-edge1[1][1])/(edge1[0][0]-edge1[1][0])
slope2 = (edge2[0][1]-edge2[1][1])/(edge2[0][0]-edge2[1][0])

slope1Yoff = edge1[0][1] - (slope1*edge1[0][0])
slope2Yoff = edge2[0][1] - (slope2*edge2[0][0])

xIntercept = (slope1Yoff - slope2Yoff) / (slope1 - slope2) *-1

print (slope1)
print (slope2)
print (slope1Yoff)
print (slope2Yoff)
print (xIntercept)

if xIntercept >= edge1[0][0] and xIntercept <= edge1[1][0]:
    print ('true')
else:
    print ('false')