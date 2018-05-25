Ext.define('PVE.panel.NotesView', {
    extend: 'Ext.panel.Panel',
    xtype: 'pveNotesView',

    title: gettext("Notes"),
    bodyStyle: 'white-space:pre',
    bodyPadding: 10,
    scrollable: true,

    tbar: {
	itemId: 'tbar',
	hidden: true,
	items: [
	    {
		text: gettext('Edit'),
		handler: function() {
		    var me = this.up('panel');
		    me.run_editor();
		}
	    }
	]
    },

    run_editor: function() {
	var me = this;
	var win = Ext.create('PVE.window.NotesEdit', {
	    pveSelNode: me.pveSelNode,
	    url: me.url
	});
	win.show();
	win.on('destroy', me.load, me);
    },

    load: function() {
	var me = this;

	Proxmox.Utils.API2Request({
	    url: me.url,
	    waitMsgTarget: me,
	    failure: function(response, opts) {
		me.update(gettext('Error') + " " + response.htmlStatus);
	    },
	    success: function(response, opts) {
		var data = response.result.data.description || '';
		me.update(Ext.htmlEncode(data));
	    }
	});
    },

    listeners: {
	render: function(c) {
	    var me = this;
	    me.getEl().on('dblclick', me.run_editor, me);
	}
    },

    tools: [{
	type: 'gear',
	handler: function() {
	    var me = this.up('panel');
	    me.run_editor();
	}
    }],

    initComponent : function() {
	var me = this;

	var nodename = me.pveSelNode.data.node;
	if (!nodename) {
	    throw "no node name specified";
	}

	var type = me.pveSelNode.data.type;
	if (!Ext.Array.contains(['node', 'qemu', 'lxc'], type)) {
	    throw 'invalid type specified';
	}

	var vmid = me.pveSelNode.data.vmid;
	if (!vmid && type !== 'node') {
	    throw "no VM ID specified";
	}

	me.url = '/api2/extjs/nodes/' + nodename + '/';

	// add the type specific path if qemu/lxc
	if (type === 'qemu' || type === 'lxc') {
	    me.url += type + '/' + vmid + '/';
	}

	me.url += 'config';

	me.callParent();
	if (type === 'node') {
	    me.down('#tbar').setVisible(true);
	}
	me.load();
    }
});
