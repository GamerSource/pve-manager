Ext.define('pve-cluster-nodes', {
    extend: 'Ext.data.Model',
    fields: [
	'node', { type: 'integer', name: 'nodeid' }, 'ring0_addr', 'ring1_addr',
	{ type: 'integer', name: 'quorum_votes' }
    ],
    proxy: {
        type: 'proxmox',
	url: "/api2/json/cluster/config/nodes"
    },
    idProperty: 'nodeid'
});

Ext.define('pve-cluster-info', {
    extend: 'Ext.data.Model',
    proxy: {
        type: 'proxmox',
	url: "/api2/json/cluster/config/join"
    }
});

Ext.define('PVE.ClusterCreateWindow', {
    extend: 'Proxmox.window.Edit',
    xtype: 'pveClusterCreateWindow',

    title: gettext('Create Cluster'),
    width: 800,

    method: 'POST',
    url: '/cluster/config',

    isCreate: true,
    subject: gettext('Cluster'),
    showProgress: true,

    items: [
	{
	    xtype: 'textfield',
	    fieldLabel: gettext('Cluster Name'),
	    name: 'clustername'
	},
	{
	    xtype: 'proxmoxtextfield',
	    fieldLabel: gettext('Ring0 Address'),
	    emptyText: 'Hostname of the node', // FIXME
	    name: 'ring0_addr',
	    skipEmptyText: true
	}
    ]
});

Ext.define('PVE.ClusterJoinNodeWindow', {
    extend: 'Proxmox.window.Edit',
    xtype: 'pveClusterJoinNodeWindow',

    title: gettext('Cluster Join'),
    width: 800,

    method: 'POST',
    url: '/cluster/config/join',

    items: [
	{
	    xtype: 'textfield',
	    fieldLabel: 'IP Address',
	    name: 'hostname'
	},
	{
	    xtype: 'textfield',
	    fieldLabel: 'Ring0 Address',
	    name: 'ring0_addr'
	},
	{
	    xtype: 'textfield',
	    inputType: 'password',
	    fieldLabel: gettext('Password'),
	    name: 'password'
	},
	{
	    xtype: 'textfield',
	    fieldLabel: gettext('Fingerprint'),
	    name: 'fingerprint'
	}
    ]
});

Ext.define('PVE.ClusterInfoWindow', {
    extend: 'Ext.window.Window',
    xtype: 'pveClusterInfoWindow',
    mixins: ['Proxmox.Mixin.CBind'],

    width: 800,
    modal: true,
    title: gettext('Cluster Join Information'),

    ipAddress: undefined,
    fingerprint: undefined,
    serialized: undefined,

    items: [
	{
	    xtype: 'component',
	    border: false,
	    padding: '10 10 10 10',
	    html: gettext("Please use the 'Join' button on the node you want to add, using the following IP address and fingerprint.")
	},
	{
	    xtype: 'container',
	    layout: 'form',
	    border: false,
	    padding: '0 10 10 10',
	    items: [
		{
		    xtype: 'textfield',
		    fieldLabel: gettext('IP Address'),
		    cbind: { value: '{ipAddress}' },
		    editable: false
		},
		{
		    xtype: 'textfield',
		    fieldLabel: gettext('Fingerprint'),
		    cbind: { value: '{fingerprint}' },
		    editable: false
		},
		{
		    xtype: 'textarea',
		    inputId: 'pveSerializedClusterInfo',
		    fieldLabel: gettext('Information'),
		    cbind: { value: '{serialized}' },
		    editable: false
		}
	    ]
	}
    ],
    dockedItems: [{
	dock: 'bottom',
	xtype: 'toolbar',
	items: [{
	    xtype: 'button',
	    handler: function(b) {
		var el = document.getElementById('pveSerializedClusterInfo');
		el.select();
		document.execCommand("copy");
	    },
	    text: gettext('Copy Information')
	}]
    }]
});

/*jslint confusion: true*/
/* bind is a function and object */
Ext.define('PVE.ClusterAdministration', {
    extend: 'Ext.panel.Panel',
    xtype: 'pveClusterAdministration',

    title: gettext('Cluster Administration'),

    border: false,
    defaults: { border: false },

    viewModel: {
	parent: null,
	data: {
	    totem: {},
	    nodelist: [],
	    preferred_node: {
		name: '',
		fp: '',
		addr: ''
	    },
	    nodecount: 0
	}
    },

    items: [
	{
	    xtype: 'grid',
	    title: gettext('Cluster Information'),
	    controller: {
		xclass: 'Ext.app.ViewController',

		init: function(view) {
		    view.store.on('load', this.onLoad, this);
		    //PVE.Utils.monStoreErrors(view, view.getStore());
		},

		onLoad: function(store, records, success) {
		    if (!success || !records || !records[0].data) {
			return;
		    }
		    var vm = this.getViewModel();
		    var data = records[0].data;
		    vm.set('totem', data.totem);
		    vm.set('nodelist', data.nodelist);

		    var nodeinfo = Ext.Array.findBy(data.nodelist, function (el) {
			return el.name === data.preferred_node;
		    });

		    vm.set('preferred_node', {
			name: data.preferred_node,
			addr: nodeinfo.pve_addr,
			fp: nodeinfo.pve_fp
		    });
		},

		onCreate: function() {
		    var view = this.getView();
		    var win = Ext.create('PVE.ClusterCreateWindow', {});
		    win.show();
		},

		onJoin: function() {
		    var view = this.getView();
		    var win = Ext.create('PVE.ClusterJoinNodeWindow', {});
		    win.show();
		    win.on('destroy', function() {
			// fixme: logout
		    });
		},

		onClusterInfo: function() {
		    var vm = this.getViewModel();

		    var serialized = Ext.JSON.encode(vm.get('totem'));
		    var win = Ext.create('PVE.ClusterInfoWindow', {
			ipAddress: vm.get('preferred_node.addr'),
			fingerprint: vm.get('preferred_node.fp'),
			serialized: Ext.util.Base64.encode(serialized)
		    });
		    win.show();
		}
	    },
	    store: {
		autoLoad: true,
		model: 'pve-cluster-info'
	    },
	    tbar: [
		{
		    text: gettext('Create'),
		    reference: 'createButton',
		    handler: 'onCreate',
		    bind: {
			disabled: '{totem.cluster_name}'
		    }
		},
		{
		    text: gettext('Cluster Information'),
		    reference: 'addButton',
		    handler: 'onClusterInfo',
		    bind: {
			disabled: '{!nodecount}'
		    }
		},
		{
		    text: gettext('Join'),
		    reference: 'joinButton',
		    handler: 'onJoin',
		    bind: {
			disabled: '{totem.cluster_name}'
		    }
		}
	    ],
	    columns: [
		{
		    header: gettext('TODO'),
		    width: 150,
		    dataIndex: 'cluster_name'
		}
	    ]
	},
	{
	    xtype: 'grid',
	    title: gettext('Nodes'),
	    controller: {
		xclass: 'Ext.app.ViewController',

		init: function(view) {
		    view.store.on('load', this.onLoad, this);
		    //Proxmox.Utils.monStoreErrors(view, view.getStore());
		},

		onLoad: function(store, records, success) {
		    var vm = this.getViewModel();
		    if (!success || !records) {
			return;
		    }
		    vm.set('nodecount', records.length);
		}
	    },
	    store: {
		autoLoad: true,
		model: 'pve-cluster-nodes'
	    },
	    tbar: [
		{
		    text: gettext('Isolate Node'),
		    reference: 'isolateButton',
		    bind: {
			disabled: '{!nodecount}'
		    }
		    //handler: alert('TODO')
		}
	    ],
	    columns: [
		{
		    header: gettext('Nodename'),
		    width: 150,
		    dataIndex: 'name'
		},
		{
		    header: gettext('ID'),
		    width: 80,
		    dataIndex: 'nodeid'
		},
		{
		    header: gettext('Votes'),
		    width: 80,
		    dataIndex: 'quorum_votes'
		},
		{
		    // FIXME
		    header: gettext('Ring {}'),
		    width: 150,
		    dataIndex: 'ring0_addr'
		},
		{
		    header: gettext('Ring {}'),
		    width: 150,
		    dataIndex: 'ring1_addr'
		}
	    ]
	}
    ]
});
