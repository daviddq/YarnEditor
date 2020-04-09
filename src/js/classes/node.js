import { data } from './data';
import { Utils } from './utils';

var globalNodeIndex = 0;
const NodeExpandWidth = 300;
const NodeExpandHeight = 150;
const ClipNodeTextLength = 1024;
const bbcode = require('bbcode');

export var Node = function(options = {}) {
  var self = this;

  this.titleStyles = [
    'title-style-1',
    'title-style-2',
    'title-style-3',
    'title-style-4',
    'title-style-5',
    'title-style-6',
    'title-style-7',
    'title-style-8',
    'title-style-9',
  ];

  // primary values
  this.index = ko.observable(globalNodeIndex++);
  this.title = ko.observable(options.title || app.getUniqueTitle());
  this.tags = ko.observable(options.tags || '');
  this.body = ko.observable(options.body || 'Empty Text');
  //this.x = ko.observable(128);
  //this.y = ko.observable(128);
  this.active = ko.observable(options.active || true);
  this.tempWidth = null;
  this.tempHeight = null;
  this.tempOpacity = null;
  this.style = null;
  this.colorID = ko.observable(options.colorID || 0);
  this.checked = false;
  this.selected = false;
  this.createX = options.x || null;
  this.createY = options.y || null;

  // clipped values for display
  this.clippedTags = ko.computed(function() {
    var tags = this.tags().split(' ');
    var output = '';
    if (this.tags().length > 0) {
      for (var i = 0; i < tags.length; i++)
        output += '<span>' + tags[i] + '</span>';
    }
    return output;
  }, this);

  this.textToHtml = function(text, showRowNumbers = false) {
    var rowCounter = 1;
    var result = showRowNumbers
      ? '<font color="pink">' + rowCounter + '.   </font>' + text
      : text;

    /// Links in preview mode
    result = result.replace(/\[\[[^\[]+\]\]/gi, function(goto) {
      const extractedGoto = goto.match(/\[\[(.*)\]\]/i);
      if (extractedGoto.length > 1) {
        return '<font color="tomato">(go:' + extractedGoto[1] + ')</font>';
      }
    });

    /// Commands in preview mode
    result = result.replace(/<</gi, "<font color='violet'>(run:");
    result = result.replace(/>>/gi, ')</font>');

    /// bbcode color tags in preview mode
    result = result.replace(/\[color=#[A-Za-z0-9]+\]/gi, function(colorCode) {
      const extractedCol = colorCode.match(/\[color=#([A-Za-z0-9]+)\]/i);
      if (extractedCol && extractedCol.length > 1) {
        return (
          '[color=#' +
          extractedCol[1] +
          ']<font color=#' +
          extractedCol[1] +
          '>&#9751</font>'
        );
      }
    });

    /// bbcode local images with path relative to the opened yarn file
    result = result.replace(/\[img\][^\[]+\[\/img\]/gi, function(imgTag) {
      const extractedImgPath = imgTag.match(/\[img\](.*)\[\/img\]/i);
      if (extractedImgPath.length > 1) {
        const fullPathToFile = data.editingFileFolder(extractedImgPath[1]);
        if (data.doesFileExist(fullPathToFile)) {
          return showRowNumbers
            ? '<img src="' + fullPathToFile + '"> </img>'
            : '<img src="' +
                fullPathToFile +
                '" width="128" height="auto"> </img>';
        } else {
          // if not a local file, try to load it as a link
          return showRowNumbers
            ? '<img src="' + extractedImgPath[1] + '"> </img>'
            : '<img src="' +
                extractedImgPath[1] +
                '" width="128" height="auto"> </img>';
        }
      }
    });

    /// do this last, as we need the newline characters in previous regex tests
    result = result.replace(/[\n\r]/g, function(row) {
      var rowAppend = '<br/>';
      rowCounter += 1;
      if (showRowNumbers) {
        rowAppend += '<font color="pink">' + rowCounter + '.   </font>';
      }
      return rowAppend;
    });
    /// other bbcode tag parsing in preview mode
    result = bbcode.parse(result);
    return result;
  };

  this.clippedBody = ko.computed(function() {
    if (app.editing()) {
      return;
    }
    var result = app.getHighlightedText(this.body());
    result = self.textToHtml(result);
    result = result.substr(0, ClipNodeTextLength);
    return result;
  }, this);

  // internal cache
  this.linkedTo = ko.observableArray();
  this.linkedFrom = ko.observableArray();

  // reference to element containing us
  this.element = null;

  this.canDoubleClick = true;

  this.create = function() {
    Utils.pushToTop($(self.element));
    self.style = window.getComputedStyle($(self.element).get(0));

    if (self.createX && self.createY) {
      self.x(self.createX);
      self.y(self.createY);
    } else {
      var parent = $(self.element).parent();
      self.x(-parent.offset().left + $(window).width() / 2 - 100);
      self.y(-parent.offset().top + $(window).height() / 2 - 100);
    }

    var updateArrowsInterval = setInterval(app.updateArrowsThrottled, 16);

    $(self.element)
      .css({ opacity: 0, scale: 0.8, y: '-=80px', rotate: '45deg' })
      .transition(
        {
          opacity: 1,
          scale: 1,
          y: '+=80px',
          rotate: '0deg',
        },
        250,
        'easeInQuad',
        function() {
          clearInterval(updateArrowsInterval);
          app.updateArrowsThrottled();
        }
      );
    self.drag();

    // OPEN NODE
    $(self.element).on('dblclick', function() {
      if (self.canDoubleClick) app.editNode(self);
    });
    Utils.addDoubleTapDetector(self.element, function() {
      if (self.canDoubleClick) app.editNode(self);
    });

    $(self.element).on('click', function(e) {
      if (e.ctrlKey) {
        if (self.selected) app.removeNodeSelection(self);
        else app.addNodeSelected(self);
      }
    });
  };

  this.setSelected = function(select) {
    self.selected = select;

    if (self.selected) $(self.element).addClass('selected');
    else $(self.element).removeClass('selected');
  };

  this.toggleSelected = function() {
    self.setSelected(!self.selected);
  };

  this.x = function(inX) {
    if (inX != undefined) $(self.element).css({ x: Math.floor(inX) });
    return Math.floor(new WebKitCSSMatrix(self.style.webkitTransform).m41);
  };

  this.y = function(inY) {
    if (inY != undefined) $(self.element).css({ y: Math.floor(inY) });
    return Math.floor(new WebKitCSSMatrix(self.style.webkitTransform).m42);
  };

  this.resetDoubleClick = function() {
    self.canDoubleClick = true;
  };

  this.tryRemove = function() {
    if (self.active()) app.deleting(this);

    setTimeout(self.resetDoubleClick, 500);
    self.canDoubleClick = false;
  };

  this.cycleColorDown = function() {
    self.doCycleColorDown();

    setTimeout(self.resetDoubleClick, 500);
    self.canDoubleClick = false;

    if (app.shifted) app.matchConnectedColorID(self);

    if (self.selected) app.setSelectedColors(self);
  };

  this.cycleColorUp = function() {
    self.doCycleColorUp();

    setTimeout(self.resetDoubleClick, 500);
    self.canDoubleClick = false;

    if (app.shifted) app.matchConnectedColorID(self);

    if (self.selected) app.setSelectedColors(self);
  };

  this.doCycleColorDown = function() {
    self.colorID(self.colorID() - 1);
    if (self.colorID() < 0) self.colorID(8);
  };

  this.doCycleColorUp = function() {
    self.colorID(self.colorID() + 1);
    if (self.colorID() > 8) self.colorID(0);
  };

  this.remove = function() {
    $(self.element).transition(
      { opacity: 0, scale: 0.8, y: '-=80px', rotate: '-45deg' },
      250,
      'easeInQuad',
      function() {
        app.removeNode(self);
        app.updateArrowsThrottled();
      }
    );
    app.deleting(null);
  };

  this.drag = function() {
    var dragging = false;
    var groupDragging = false;

    var offset = [0, 0];
    var moved = false;

    $(document.body).on('mousemove touchmove', function(e) {
      if (dragging) {
        var parent = $(self.element).parent();
        const pageX =
          app.hasTouchScreen && e.changedTouches
            ? e.changedTouches[0].pageX
            : e.pageX;
        const pageY =
          app.hasTouchScreen && e.changedTouches
            ? e.changedTouches[0].pageY
            : e.pageY;

        var newX = pageX / self.getScale() - offset[0];
        var newY = pageY / self.getScale() - offset[1];

        if (e.metaKey || e.ctrlKey) {
          newX = Math.floor(newX/10) * 10;
          newY = Math.floor(newY/10) * 10;
        }
        else if (e.altKey) {
          newX = Math.floor(newX/50) * 50;
          newY = Math.floor(newY/50) * 50;
        }

        self.x(newX);
        self.y(newY);

        moved = true;
        var movedX = newX - self.x();
        var movedY = newY - self.y();

        if (groupDragging) {
          var nodes = [];
          if (self.selected) {
            nodes = app.getSelectedNodes();
            nodes.splice(nodes.indexOf(self), 1);
          } else {
            nodes = app.getNodesConnectedTo(self);
          }

          if (nodes.length > 0) {
            for (var i in nodes) {
              nodes[i].x(nodes[i].x() + movedX);
              nodes[i].y(nodes[i].y() + movedY);
            }
          }
        }

        //app.refresh();
        app.updateArrowsThrottled();
      }
    });

    $(self.element).on('pointerdown', function(e) {
      if (!dragging && self.active()) {
        var parent = $(self.element).parent();

        dragging = true;

        if (app.shifted || self.selected) {
          groupDragging = true;
        }

        offset[0] = e.pageX / self.getScale() - self.x();
        offset[1] = e.pageY / self.getScale() - self.y();
      }
    });

    $(self.element).on('pointerdown', function(e) {
      e.stopPropagation();
    });

    $(self.element).on('pointerup', function(e) {
      if (!moved) app.mouseUpOnNodeNotMoved();
      moved = false;
    });

    $(document.body).on('pointerup touchend', function(e) {
      dragging = false;
      groupDragging = false;
      moved = false;

      if (app.hasTouchScreen) {
        app.deselectAllNodes();
      }

      app.updateArrowsThrottled();
    });
  };

  this.moveTo = function(newX, newY) {
    $(self.element).clearQueue();
    $(self.element).transition(
      {
        x: newX,
        y: newY,
      },
      app.updateArrowsThrottled,
      500
    );
  };

  this.isConnectedTo = function(otherNode, checkBack) {
    if (checkBack && otherNode.isConnectedTo(self, false)) return true;

    var linkedNodes = self.linkedTo();
    for (var i in linkedNodes) {
      if (linkedNodes[i] == otherNode) return true;
      if (linkedNodes[i].isConnectedTo(otherNode, false)) return true;
      if (otherNode.isConnectedTo(linkedNodes[i], false)) return true;
    }

    return false;
  };

  this.getLinksInNode = function(node) {
    var links = (node || self).body().match(/\[\[(.*?)\]\]/g);

    if (links != undefined) {
      var exists = {};
      for (var i = links.length - 1; i >= 0; i--) {
        links[i] = links[i].substr(2, links[i].length - 4).trim(); //.toLowerCase();

        if (links[i].indexOf('|') >= 0) {
          links[i] = links[i].split('|')[1];
        }

        if (exists[links[i]] != undefined) {
          links.splice(i, 1);
        }
        exists[links[i]] = true;
      }
      return links;
    } else {
      return undefined;
    }
  };

  this.updateLinks = function() {
    self.resetDoubleClick();
    self.updateLinksFromParents();
    self.updateLinksToChildren();
  };

  this.updateLinksFromParents = function() {
    // If title didn't change there's nothing we need to update on parents
    if (!self.oldTitle || self.oldTitle === self.title()) {
      return;
    }

    self.linkedFrom.removeAll();

    app.nodes().forEach(parent => {
      var parentLinks = self.getLinksInNode(parent);
      if (parentLinks && parentLinks.includes(self.oldTitle)) {
        var re = RegExp('\\|\\s*' + self.oldTitle + '\\s*\\]\\]', 'g');
        var newBody = parent.body().replace(re, '|' + self.title() + ']]');
        parent.body(newBody);
        self.linkedFrom.push(parent);
      }
    });

    self.oldTitle = undefined;
  };

  this.updateLinksToChildren = function() {
    self.linkedTo.removeAll();

    var links = self.getLinksInNode();

    if (!links) {
      return;
    }

    for (var index in app.nodes()) {
      var other = app.nodes()[index];
      for (var i = 0; i < links.length; i++) {
        if (other != self && other.title().trim() === links[i].trim()) {
          self.linkedTo.push(other);
        }
      }
    }
  };

  this.getScale = function() {
    if (app && typeof app.cachedScale === 'number') {
      return app.cachedScale;
    } else {
      return 1;
    }
  };
};

ko.bindingHandlers.nodeBind = {
  init: function(
    element,
    valueAccessor,
    allBindings,
    viewModel,
    bindingContext
  ) {
    bindingContext.$rawData.element = element;
    bindingContext.$rawData.create();
  },

  update: function(
    element,
    valueAccessor,
    allBindings,
    viewModel,
    bindingContext
  ) {
    $(element).on('pointerdown', function() {
      Utils.pushToTop($(element));
    });
  },
};
