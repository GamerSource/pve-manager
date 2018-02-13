/*jslint confusion: true*/
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
	    fieldLabel: gettext('Ring 0 Address'),
	    emptyText: gettext("Optional, defaults to IP resolved by node's hostname"),
	    name: 'ring0_addr',
	    skipEmptyText: true
	}
    ]
});


Ext.define('PVE.ClusterJoinTotemInfo', {
    extend: 'Ext.panel.Panel',
    xtype: 'pveClusterJoinTotemInfo',

    border: false,
    layout: 'column',
    columns: 2,
    defaultType: 'container',

    viewModel: {
	data: {
	    totem: {}
	}
    },

    setTotem: function(totem) {
	var vm = this.getViewModel();
	vm.set('totem', totem);
    },

    items: [
	{
	    columnWidth: 0.5,
	    padding: '0 10 0 0',
	    layout: 'anchor',
	    items: [
		{
		    xtype: 'displayfield',
		    fieldLabel: gettext('Cluster Name'),
		    value: 'Unknown',
		    bind: {
			value: '{totem.cluster_name}'
		    }
		},
		{
		    xtype: 'displayfield',
		    fieldLabel: gettext('IP Version'),
		    bind: {
			value: '{totem.ip_version}'
		    }
		},
		{
		    xtype: 'displayfield',
		    fieldLabel: gettext('Protocol'),
		    renderer: function (v) {
			if (!v || v === 'udp') {
			    return 'Multicast';
			}
			return 'Unicast';
		    },
		    bind: {
			value: '{totem.transport}'
		    }
		}
	    ]
	},
	{
	    columnWidth: 0.5,
	    padding: '0 0 0 10',
	    layout: 'anchor',
	    items: [
		{
		    xtype: 'displayfield',
		    renderer: Proxmox.Utils.format_boolean,
		    fieldLabel: gettext('Redundant Ring'),
		    bind: {
			value: '{totem.interface.1}'
		    }
		},
		{
		    xtype: 'displayfield',
		    fieldLabel: gettext('Bind 0 Address'),
		    bind: {
			value: '{totem.interface.0.bindnetaddr}'
		    }
		},
		{
		    xtype: 'displayfield',
		    fieldLabel: gettext('Bind 1 Address'),
		    bind: {
			value: '{totem.interface.1.bindnetaddr}'
		    }
		}
	    ]
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

    defaultFocus: 'textarea[name=serializedinfo]',
    isCreate: true,
    submitText: gettext('Join'),

    onlineHelp: 'chapter_pvecm',

    viewModel: {
	parent: null,
	data: {
	    info: {
		fp: '',
		ip: '',
		ring1Possible: false,
		ring1Needed: false
	    }
	}
    },

    controller: {
	xclass: 'Ext.app.ViewController',
	control: {
	    'proxmoxcheckbox[name=assistedInput]': {
		change: 'onInputTypeChange'
	    },
	    'textarea[name=serializedinfo]': {
		change: 'recomputeSerializedInfo',
		enable: 'resetField'
	    },
	    'proxmoxtextfield[name=ring1_addr]': {
		enable: 'ring1Needed'
	    },
	    'textfield': {
		disable: 'resetField'
	    }
	},
	resetField: function(field) {
	    field.reset();
	},
	ring1Needed: function(f) {
	    var vm = this.getViewModel();
	    f.allowBlank = !vm.get('info.ring1Needed');
	},
	onInputTypeChange: function(field, assistedInput) {
	    var vm = this.getViewModel();
	    if (!assistedInput) {
		vm.set('info.ring1Possible', true);
	    }
	},
	recomputeSerializedInfo: function(field, value) {
	    var vm = this.getViewModel();
	    var jsons = Ext.util.Base64.decode(value);
	    var joinInfo = Ext.JSON.decode(jsons, true);

	    var info = {
		fp: '',
		ring1Needed: false,
		ring1Possible: false,
		ip: ''
	    };

	    var totem = {};
	    if (!(joinInfo && joinInfo.totem)) {
		field.valid = false;
	    } else {
		info = {
		    ip: joinInfo.ipAddress,
		    fp: joinInfo.fingerprint,
		    ring1Possible: !!joinInfo.totem['interface']['1'],
		    ring1Needed: !!joinInfo.totem['interface']['1']
		};
		totem = joinInfo.totem;
		field.valid = true;
	    }

	    this.getView().down('pveClusterJoinTotemInfo').setTotem(totem);
	    vm.set('info', info);
	}
    },

    items: [{
	xtype: 'inputpanel',
	column1: [
	    {
		xtype: 'textfield',
		fieldLabel: gettext('Peer Address'),
		allowBlank: false,
		bind: {
		    value: '{info.ip}',
		    readOnly: '{assistedEntry.checked}'
		},
		name: 'hostname'
	    },
	    {
		xtype: 'textfield',
		inputType: 'password',
		emptyText: gettext("Peer's root password"),
		fieldLabel: gettext('Password'),
		allowBlank: false,
		name: 'password'
	    }
	],
	column2: [
	    {
		xtype: 'proxmoxtextfield',
		fieldLabel: gettext('Corosync Ring 0'),
		emptyText: gettext("Default: IP resolved by node's hostname"),
		skipEmptyText: true,
		name: 'ring0_addr'
	    },
	    {
		xtype: 'proxmoxtextfield',
		fieldLabel: gettext('Corosync Ring 1'),
		skipEmptyText: true,
		bind: {
		    disabled: '{!info.ring1Possible}'
		},
		name: 'ring1_addr'
	    }
	],
	columnB: [
	    {
		xtype: 'textfield',
		fieldLabel: gettext('Fingerprint'),
		allowBlank: false,
		bind: {
		    value: '{info.fp}',
		    readOnly: '{assistedEntry.checked}'
		},
		name: 'fingerprint'
	    },
	    {
		xtype: 'textarea',
		name: 'serializedinfo',
		submitValue: false,
		allowBlank: false,
		fieldLabel: gettext('Information'),
		emptyText: gettext('Paste encoded Cluster Information'),
		validator: function(val) {
		    return val === '' || this.valid ||
		       gettext('Seems not like a valid encoded Cluster Information!');
		},
		bind: {
		    disabled: '{!assistedEntry.checked}',
		    hidden: '{!assistedEntry.checked}'
		},
		value: ''
	    },
	    {
		xtype: 'pveClusterJoinTotemInfo',
		bind: {
		    hidden: '{!assistedEntry.checked}'
		}
	    }
	]
    }],
    footerEl: {
	xtype: 'proxmoxcheckbox',
	reference: 'assistedEntry',
	submitValue: false,
	value: true,
	autoEl: {
	    tag: 'div',
	    'data-qtip': gettext('Select if join information should be extracted from pasted cluster information, diselect for manual entering')
	},
	boxLabel: gettext('Assisted join with encoded cluster information')
    }
});

Ext.define('PVE.ClusterInfoWindow', {
    extend: 'Ext.window.Window',
    xtype: 'pveClusterInfoWindow',
    mixins: ['Proxmox.Mixin.CBind'],

    width: 800,
    modal: true,
    title: gettext('Cluster Join Information'),

    joinInfo: {
	ipAddress: undefined,
	fingerprint: undefined,
	totem: {}
    },

    items: [
	{
	    xtype: 'component',
	    border: false,
	    padding: '10 10 10 10',
	    html: gettext("Copy the Join Information here and use it on the node you want to add.")
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
		    cbind: { value: '{joinInfo.ipAddress}' },
		    editable: false
		},
		{
		    xtype: 'textfield',
		    fieldLabel: gettext('Fingerprint'),
		    cbind: { value: '{joinInfo.fingerprint}' },
		    editable: false
		},
		{
		    xtype: 'textarea',
		    inputId: 'pveSerializedClusterInfo',
		    fieldLabel: gettext('Join Information'),
		    grow: true,
		    cbind: { joinInfo: '{joinInfo}' },
		    editable: false,
		    listeners: {
			afterrender: function(field) {
			    if (!field.joinInfo) {
				return;
			    }
			    var jsons = Ext.JSON.encode(field.joinInfo);
			    var base64s = Ext.util.Base64.encode(jsons);
			    field.setValue(base64s);
			}
		    }
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
		    var win = Ext.create('PVE.ClusterCreateWindow', {});
		    win.show();
		},

		onJoin: function() {
		    var win = Ext.create('PVE.ClusterJoinNodeWindow', {});
		    win.show();
		    win.on('destroy', function() {
			// fixme: logout
		    });
		},

		onClusterInfo: function() {
		    var vm = this.getViewModel();
		    var win = Ext.create('PVE.ClusterInfoWindow', {
			joinInfo: {
			    ipAddress: vm.get('preferred_node.addr'),
			    fingerprint: vm.get('preferred_node.fp'),
			    totem: vm.get('totem')
			}
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
		    text: gettext('Create Cluster'),
		    reference: 'createButton',
		    handler: 'onCreate',
		    bind: {
			disabled: '{totem.cluster_name}'
		    }
		},
		{
		    text: gettext('Join Information'),
		    reference: 'addButton',
		    handler: 'onClusterInfo',
		    bind: {
			disabled: '{!nodecount}'
		    }
		},
		{
		    text: gettext('Join Cluster'),
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
		    flex: 1,
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
		    hidden: true
		    //bind: {
			//disabled: '{!nodecount}'
		    //}
		    //handler: alert('TODO')
		}
	    ],
	    columns: [
		{
		    header: gettext('Nodename'),
		    flex: 2,
		    dataIndex: 'name'
		},
		{
		    header: gettext('ID'),
		    flex: 1,
		    dataIndex: 'nodeid'
		},
		{
		    header: gettext('Votes'),
		    flex: 1,
		    dataIndex: 'quorum_votes'
		},
		{
		    // FIXME
		    header: gettext('Ring 0'),
		    flex: 2,
		    dataIndex: 'ring0_addr'
		},
		{
		    header: gettext('Ring 1'),
		    flex: 2,
		    dataIndex: 'ring1_addr'
		}
	    ]
	}
    ]
});
