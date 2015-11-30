var PdView = (function() {

    var d3 = d3 || d3_tiny;

    var ƒ = Rpd.unit,
        not = Rpd.not;

    var stopPropagation = Rpd.Render.stopPropagation;

    var editorNode;
    var startEditing = Kefir.emitter(),
        finishEditing = Kefir.emitter();

    var selection = null;
    var startSelection = Kefir.emitter(),
        finishSelection = Kefir.emitter();

    var editModeOn = Kefir.emitter(),
        editModeOff = Kefir.emitter();

    function PdView(defaultSize) {
        this.inEditMode = Kefir.merge([ editModeOn.map(ƒ(true)),
                                        editModeOff.map(ƒ(false)) ]).toProperty(ƒ(false));
        editorNode = d3.select(document.createElement('input'))
                           .attr('type', 'text')
                           .attr('class', 'rpd-pd-text-editor')
                           .style('width', '300px')
                           .style('height', (defaultSize.height + 1) + 'px')
                           .node();
        document.addEventListener('DOMContentLoaded', function() {
           d3.select(document.body)
             .append(d3.select(editorNode)
                       .style('display', 'none')
                       .style('position', 'absolute').node());
        });
    }

    PdView.prototype.addSelection = function(selectNode) {
        Kefir.fromEvents(selectNode, 'click')
             .filterBy(this.inEditMode.map(not))
             .map(stopPropagation)
             .onValue(function() {

                 startSelection.emit();
                 if (selection) d3.select(selection).classed('rpd-pd-selected', false);
                 selection = selectNode;
                 d3.select(selectNode).classed('rpd-pd-selected', true);

                 Kefir.fromEvents(document.body, 'click').take(1)
                      .onValue(function() {

                          d3.select(selectNode).classed('rpd-pd-selected', false);
                          selection = null;
                          finishSelection.emit();

                      });
             });
    }

    PdView.prototype.addEditor = function(selectNode, textNode, onSubmit) {
        var text = d3.select(textNode);
        var editor = d3.select(editorNode);
        Kefir.fromEvents(selectNode, 'click')
             .filterBy(this.inEditMode.map(not))
             .map(stopPropagation)
             .map(function() { return text.text(); })
             .onValue(function(textValue) {
                 startEditing.emit();

                 var brect = textNode.getBoundingClientRect();
                 editor.classed('rpd-pd-selected', true)
                       .style('top', (brect.top - 5) + 'px')
                       .style('left', (brect.left - 1) + 'px');
                 editor.node().value = textValue || '';
                 editorNode.setSelectionRange(0, editorNode.value.length);
                 text.text('').style('display', 'none');
                 editor.style('display', 'block')
                       .node().focus();

                 Kefir.merge([ Kefir.fromEvents(document.body, 'click'),
                               Kefir.fromEvents(editorNode, 'keydown')
                                    .map(function(evt) { return evt.keyCode; })
                                    .filter(function(key) { return key === 13; }),
                               startSelection
                             ]).take(1)
                      .onValue(function() {

                          var value = editor.node().value;

                          editorNode.blur();
                          text.text(value);
                          editor.node().value = '';
                          editor.style('display', 'none')
                                .classed('rpd-pd-selected', false);
                          text.style('display', 'block');

                          finishEditing.emit();

                          if (onSubmit) onSubmit(value);
                      });
             });
    }

    PdView.prototype.addEditModeSwitch = function(switchNode, targetNode) {
        Kefir.fromEvents(switchNode, 'click')
             .map(stopPropagation)
             .map(ƒ(true))
             .scan(Rpd.not) // will toggle between `true` and `false`
             .onValue(function(val) {
                 if (val) { editModeOn.emit(); } else { editModeOff.emit(); };
                 d3.select(targetNode).classed('rpd-pd-enabled', val);
             });
    }

    PdView.prototype.addNodeAppender = function(buttonNode, nodeType, targetPatch) {
        Kefir.fromEvents(buttonNode, 'click')
             .map(stopPropagation)
             .onValue(function() {
                 targetPatch.addNode(nodeType);
             });
    }

    PdView.prototype.addValueSend = function(sourceNode, node, inlet, getValue) {
        var styleTimeout;
        Kefir.fromEvents(sourceNode, 'click')
             .filterBy(this.inEditMode)
             .map(stopPropagation)
             .onValue(function() {
                 if (styleTimeout) clearTimeout(styleTimeout);
                 d3.select(sourceNode).classed('rpd-pd-send-value', true);
                 styleTimeout = setTimeout(function() {
                     d3.select(sourceNode).classed('rpd-pd-send-value', false);
                 }, 300);
                 node.inlets[inlet].receive(getValue());
             });
    }

    PdView.prototype.addSpinner = function(sourceNode) {
        return new Spinner(sourceNode, this.inEditMode);
    }

    PdView.prototype.measureText = function(textHolder) {
        var bbox = textHolder.node().getBBox();
        return { width: bbox.width, height: bbox.height };
    }

    // ================================ Spinner ====================================

    function extractPos(evt) { return { x: evt.clientX,
                                        y: evt.clientY }; };
    function Spinner(element, editMode) {
        this.element = element;
        this.min = -Infinity;
        this.max = Infinity;
        this.value = 0;

        var spinner = this;

        this.incoming = Kefir.emitter();
        /*changes.onValue(function(value) {
            spinner.value = val;
        });*/

        Kefir.fromEvents(element, 'mousedown')
             .filterBy(editMode)
             .map(stopPropagation)
             .map(extractPos)
             .flatMap(function(startPos) {
                 var start = spinner.value;
                 return Kefir.fromEvents(document.body, 'mousemove')
                             .map(extractPos)
                             .takeUntilBy(Kefir.fromEvents(document.body, 'mouseup'))
                             .map(function(newPos) { return start + (newPos.y - startPos.y); })
                             .onValue(function(num) { spinner.incoming.emit(num); })
             }).onEnd(function() {});

        this.changes = this.incoming.map(function(value) {
            return spinner.setValue(value); // returns value updated to bounds
        });
        //this.changes.onValue(function() {});
    }
    Spinner.prototype.setValue = function(value) {
        this.value = value;
        return this.checkValue();
    }
    Spinner.prototype.checkValue = function() {
        if (isNaN(this.value) || (this.value < this.min)) {
            this.value = this.min; this.incoming.emit(this.min);
        }
        if (this.value > this.max) {
            this.value = this.max; this.incoming.emit(this.max);
        }
        return this.value;
    }
    Spinner.prototype.updateBounds = function(min, max) {
        this.min = min || 0;
        this.max = isNaN(max) ? Infinity : max;
        return this.checkValue();
    }
    Spinner.prototype.getChangesStream = function() {
        return this.changes;
    }

    return PdView;

})();

var PdModel = (function() {

    var WebPd = window.Pd || null;
    if (!WebPd) throw new Error('Building PD Model requires WebPd present');

    var pdResolveObject = (function() {
        return function(patch, command, _arguments) {
            try {
                return patch.webPdPatch.createObject(command, _arguments);
            } catch (e) {
                if (!(e instanceof WebPd.core.errors.UnkownObjectError)) {
                    console.error(e, command, _arguments);
                }
                return null;
            }
        };

    })();

    var requestResolveEmitter = Kefir.emitter();
    var isResolvedEmitter = Kefir.emitter();

    var events = {
        // This event is emitted every time object node needs to be
        // resolved, i.e. to determine if we know command it contains,
        // emits PdObjectResolved event with a result, on each value.
        // event is: { node: node, command: [] }
        'object/request-resolve': requestResolveEmitter,
        // This event is emitted every time object node got (or lost)
        // the appropriate function, so the number of inlets/outlets
        // changed and style should be changed as well.
        // Renderer subscribes to this event.
        // event is: { node: node,
        //             command: command,
        //             arguments: [],
        //             definition: { inlets, outlets, process } }
        //       or: { node: node,
        //             command: command,
        //             arguments: [],
        //             definition: null }, if command wasn't succesfully parsed
        'object/is-resolved': isResolvedEmitter.toProperty()
    };

    requestResolveEmitter.map(function(value) {
        return {
            node: value.node, patch: value.node.patch,
            command: value.command, arguments: value.arguments,
            object: pdResolveObject(value.node.patch, value.command, value.arguments)
        };
    }).onValue(function(value) {
        isResolvedEmitter.emit(value);
    });

    function PdModel(patch, webPdPatch) {
        this.patch = patch;
        this.webPdPatch = webPdPatch;

        this.nodeToInlets = {};
        this.nodeToOutlets = {};

        this.webPdDummy = { patch: webPdPatch };
    };

    var DspInlet = Pd.core.portlets.DspInlet,
        DspOutlet = Pd.core.portlets.DspOutlet;

    function getInletType(pdInlet) {
        return (pdInlet instanceof DspInlet) ? 'pd/dsp' : 'pd/any';
    }
    function getOutletType(pdOutlet) {
        return (pdOutlet instanceof DspOutlet) ? 'pd/dsp' : 'pd/any';
    }

    // add required inlets and outlets to the node using the properties from resove-event
    PdModel.prototype.applyDefinition = function(node, command, _arguments, object) {
        var nodeToInlets = this.nodeToInlets,
            nodeToOutlets = this.nodeToOutlets;

        if (nodeToInlets[node.id]) {
            nodeToInlets[node.id].forEach(function(inlet) { node.removeInlet(inlet); });
            nodeToInlets[node.id] = null;
        }
        if (nodeToOutlets[node.id]) {
            nodeToOutlets[node.id].forEach(function(outlet) { node.removeOutlet(outlet); });
            nodeToOutlets[node.id] = null;
        }
        if (!object) return;

        var pdInlets = object.inlets || {},
            pdOutlets = object.outlets || {};
        var savedInlets = [], savedOutlets = [];
        pdInlets.forEach(function(pdInlet, idx) {
            savedInlets.push(node.addInlet(getInletType(pdInlet), idx.toString()));
        });
        pdOutlets.forEach(function(pdOutlet, idx) {
            savedOutlets.push(node.addOutlet(getOutletType(pdOutlet), idx.toString()));
        });
        nodeToInlets[node.id] = savedInlets.length ? savedInlets : null;
        nodeToOutlets[node.id] = savedOutlets.length ? savedOutlets : null;

        var dummy = this.webPdDummy;
        var curObject = node.webPdObject;
        var newObject = object;
        //console.log(newObject, command, _arguments);
        if (newObject) {
            if (savedInlets) {
                savedInlets.forEach(function(inlet, idx) {
                    //console.log('inlet', idx, newObject.inlets[idx]);
                    if (inlet.type === 'pd/dsp') return;
                    // TODO: disconnect/unsubscribe previously connected links
                    inlet.event['inlet/update'].onValue(function(val) {
                        newObject.inlets[idx].message([val]);
                    });
                });
            }
            if (savedOutlets) {
                savedOutlets.forEach(function(outlet, idx) {
                    if (outlet.type === 'pd/dsp') return;
                    var receiver = new WebPd.core.portlets.Inlet(dummy);
                    receiver.message = function(args) {
                        outlet.send(args);
                    };
                    //console.log('outlet', idx, newObject.outlets[idx]);
                    // TODO: disconnect previously connected links
                    newObject.outlets[idx].connect(receiver);
                });
            }
        }
    };

    PdModel.prototype.requestResolve = function(node, command, _arguments) {
        requestResolveEmitter.emit({ node: node,
                                     command: command,
                                     arguments: _arguments });
    };

    PdModel.prototype.whenResolved = function(node, callback) {
        isResolvedEmitter.filter(function(value) {
            return value.node.id === node.id;
        }).onValue(callback);
    };

    PdModel.prototype.configureSymbol = function(node, command, _arguments) {

    };

    PdModel.TYPE_MAP = {
        'obj':        'pd/object',
        'msg':        'pd/message',
        'floatatom':  'pd/number',
        'symbolatom': 'pd/symbol',
        'text':       'pd/comment',
        'bng':        'pd/bang',
        'tgl':        'pd/toggle',
        'nbx':        null, // 'pd/number-2'
        'vsl':        null, // 'pd/vslider'
        'hsl':        null, // 'pd/hslider'
        'vradio':     null, // 'pd/vradio'
        'hradio':     null, // 'pd/hradio'
        'vu':         null, // 'pd/vumeter'
        'cnv':        null, // 'pd/canvas'
        'graph':      null, // 'pd/graph'
        'array':      null  // 'pd/array'
    };

    return PdModel;

})();
