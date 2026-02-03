/**
 * =============================================
 *      MODULE DE CALCUL DE CHEMIN (Pathfinding) - Version avec journalisation du chemin
 * =============================================
 */
const pathfinder = {
    
    graph: null,
    nodes: [],

    buildGraph(segments) {
        console.log("Pathfinder: Construction du graphe basée sur les règles métier.");
        const graph = new Map();
        const points = new Map();

        segments.forEach(seg => {
            const keyStart = `${seg.sx},${seg.sy}`;
            if (!points.has(keyStart)) points.set(keyStart, { x: parseInt(seg.sx), y: parseInt(seg.sy), key: keyStart });
            
            const keyEnd = `${seg.ex},${seg.ey}`;
            if (!points.has(keyEnd)) points.set(keyEnd, { x: parseInt(seg.ex), y: parseInt(seg.ey), key: keyEnd });
        });

        this.nodes = Array.from(points.values());
        this.nodes.forEach(node => graph.set(node.key, []));

        segments.forEach(currentSeg => {
            const keyStart = `${currentSeg.sx},${currentSeg.sy}`;
            const keyEnd = `${currentSeg.ex},${currentSeg.ey}`;
            const distance = Math.sqrt(Math.pow(currentSeg.ex - currentSeg.sx, 2) + Math.pow(currentSeg.ey - currentSeg.sy, 2));

            graph.get(keyStart).push({ node: keyEnd, weight: distance });

            if (String(currentSeg.Two_direct).toLowerCase() === 'true') {
                graph.get(keyEnd).push({ node: keyStart, weight: distance });
            }
        });
        
        segments.forEach(segOut => {
            const endPointKey = `${segOut.ex},${segOut.ey}`;
            segments.forEach(segIn => {
                if (segOut.segment_id === segIn.segment_id) return;
                const startPointKey = `${segIn.sx},${segIn.sy}`;
                if (endPointKey === startPointKey) {
                    const existingConnection = graph.get(endPointKey)?.find(c => c.node === startPointKey);
                    if (!existingConnection) {
                         const dist = Math.sqrt(Math.pow(segIn.sx - segOut.ex, 2) + Math.pow(segIn.sy - segOut.ey, 2));
                         graph.get(endPointKey).push({ node: startPointKey, weight: dist });
                    }
                }
            });
        });

        this.graph = graph;
        console.log(`Pathfinder: Graphe final construit avec ${this.nodes.length} carrefours.`);
    },

    findClosestNode(point) {
        let closest = null;
        let minDistance = Infinity;
        this.nodes.forEach(node => {
            const distance = Math.sqrt(Math.pow(node.x - point.x, 2) + Math.pow(node.y - point.y, 2));
            if (distance < minDistance) {
                minDistance = distance;
                closest = node;
            }
        });
        return closest;
    },

    dijkstra(startNodeKey, endNodeKey) {
        const distances = new Map();
        const prev = new Map();
        const pq = new Set();

        this.nodes.forEach(node => {
            distances.set(node.key, Infinity);
            prev.set(node.key, null);
            pq.add(node.key);
        });

        distances.set(startNodeKey, 0);

        while (pq.size > 0) {
            let u = [...pq].reduce((minNode, node) => 
                distances.get(node) < distances.get(minNode) ? node : minNode,
                [...pq][0]
            );

            if (u === endNodeKey || distances.get(u) === Infinity) break;
            
            pq.delete(u);

            this.graph.get(u)?.forEach(neighbor => {
                if (pq.has(neighbor.node)) {
                    const alt = distances.get(u) + neighbor.weight;
                    if (alt < distances.get(neighbor.node)) {
                        distances.set(neighbor.node, alt);
                        prev.set(neighbor.node, u);
                    }
                }
            });
        }

        const path = [];
        let current = endNodeKey;
        while (current) {
            const node = this.nodes.find(n => n.key === current);
            if (!node) break;
            path.unshift({ x: node.x, y: node.y });
            current = prev.get(current);
        }
        
        const startNode = this.nodes.find(n => n.key === startNodeKey);
        if (path.length > 0 && path[0].x === startNode.x && path[0].y === startNode.y) {
            return { path: path, distance: distances.get(endNodeKey) };
        }
        return { path: null, distance: Infinity };
    },

    calculateOptimalPath(orderItems, allData) {
        if (!this.graph || this.graph.size === 0 || this.nodes.length === 0) {
            console.error("Le graphe de l'entrepôt n'est pas construit.");
            return null;
        }

        const startPointNode = this.findClosestNode({x: 6026, y: 960});
        if (!startPointNode) {
            console.error("Impossible de trouver le point de départ du chemin.");
            return null;
        }
        
        const racksToVisit = [...new Set(
            orderItems.map(item => {
                const product = allData.products.find(p => p.product_id === item.product_id);
                if (!product || !product.rack_id) {
                    console.warn(`Produit ${item.product_id} ignoré: emplacement inconnu.`);
                    return null;
                }
                const rack = allData.racks.find(r => r.Rack_Id === product.rack_id);
                if (!rack) {
                    console.warn(`Rack ${product.rack_id} pour produit ${item.product_id} ignoré: rack non trouvé.`);
                    return null;
                }
                return product.rack_id;
            }).filter(Boolean)
        )];

        let locationsToVisit = racksToVisit.map(rackId => {
            const rack = allData.racks.find(r => r.Rack_Id === rackId);
            if (!rack) return null; 
            return {
                x: parseInt(rack.Position_X) + parseInt(rack.L_x) / 2,
                y: parseInt(rack.Position_Y) + parseInt(rack.L_Y) / 2
            };
        }).filter(Boolean);

        if (locationsToVisit.length === 0) {
            console.warn("Aucun emplacement valide à visiter pour cette commande après filtrage.");
            return null;
        }

        let fullPath = [ {x: startPointNode.x, y: startPointNode.y} ];
        let currentNodeKey = startPointNode.key;

        while (locationsToVisit.length > 0) {
            let bestTargetIndex = -1;
            let shortestPathToTarget = null;
            let shortestDistance = Infinity;
            let endNodeOfShortestPath = null;

            for (let i = 0; i < locationsToVisit.length; i++) {
                const targetLocation = locationsToVisit[i];
                const endNode = this.findClosestNode(targetLocation);
                if (currentNodeKey && endNode) {
                    const { path, distance } = this.dijkstra(currentNodeKey, endNode.key);
                    
                    if (path && distance < shortestDistance) {
                        shortestDistance = distance;
                        shortestPathToTarget = path;
                        bestTargetIndex = i;
                        endNodeOfShortestPath = endNode;
                    }
                }
            }

            if (shortestPathToTarget) {
                fullPath = fullPath.concat(shortestPathToTarget.slice(1));
                currentNodeKey = endNodeOfShortestPath.key;
                locationsToVisit.splice(bestTargetIndex, 1);
            } else {
                console.error("Impossible de trouver un chemin vers la prochaine destination. Le graphe est peut-être discontinu ou la destination est inaccessible.");
                return null;
            }
        }

        const { path: returnPath } = this.dijkstra(currentNodeKey, startPointNode.key);
        if (returnPath) {
            fullPath = fullPath.concat(returnPath.slice(1));
        }
        
        // ▼▼▼ AJOUT : Afficher les points du chemin calculé dans la console ▼▼▼
        if (fullPath && fullPath.length > 1) {
            console.log("Chemin final calculé. Voici les points (carrefours) à suivre :");
            console.table(fullPath);
        } else {
            console.warn("Aucun chemin n'a été généré.");
        }
        // ▲▲▲ FIN DE L'AJOUT ▲▲▲

        return fullPath;
    },

    animatePath(path, svgContainer) {
        if (!path || path.length < 2) return;

        const oldElements = svgContainer.querySelectorAll('.animation-layer');
        oldElements.forEach(el => el.remove());

        const animationLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        animationLayer.classList.add('animation-layer');

        const pathString = "M" + path.map(p => `${p.x} ${p.y}`).join(" L");
        const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElement.setAttribute('d', pathString);
        pathElement.setAttribute('fill', 'none');
        pathElement.setAttribute('stroke', '#c53030');
        pathElement.setAttribute('stroke-width', '8');
        pathElement.setAttribute('stroke-opacity', '0.7');
        pathElement.setAttribute('stroke-linecap', 'round');
        animationLayer.appendChild(pathElement);
        
        const pickerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        pickerDot.setAttribute('r', '15');
        pickerDot.setAttribute('fill', 'blue');
        pickerDot.setAttribute('stroke', 'white');
        pickerDot.setAttribute('stroke-width', '2');
        pickerDot.style.offsetPath = `path('${pathString}')`;
        
        animationLayer.appendChild(pickerDot);
        svgContainer.appendChild(animationLayer);

        const totalLength = pathElement.getTotalLength();
        if (totalLength === 0) return;

        pickerDot.animate(
            [ { offsetDistance: '0%' }, { offsetDistance: '100%' } ],
            { duration: totalLength * 10, easing: 'linear', iterations: 1, fill: 'forwards' }
        );
    }
};