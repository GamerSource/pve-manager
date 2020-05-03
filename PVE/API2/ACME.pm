package PVE::API2::ACME;

use strict;
use warnings;

use PVE::ACME;
use PVE::CertHelpers;
use PVE::Certificate;
use PVE::Exception qw(raise raise_param_exc);
use PVE::JSONSchema qw(get_standard_option);
use PVE::NodeConfig;
use PVE::Tools qw(extract_param);

use IO::Handle;

use base qw(PVE::RESTHandler);

my $acme_account_dir = PVE::CertHelpers::acme_account_dir();

__PACKAGE__->register_method ({
    name => 'index',
    path => '',
    method => 'GET',
    permissions => { user => 'all' },
    description => "ACME index.",
    parameters => {
	additionalProperties => 0,
	properties => {
	    node => get_standard_option('pve-node'),
	},
    },
    returns => {
	type => 'array',
	items => {
	    type => "object",
	    properties => {},
	},
	links => [ { rel => 'child', href => "{name}" } ],
    },
    code => sub {
	my ($param) = @_;

	return [
	    { name => 'certificate' },
	];
    }});

my $get_plugin_type = sub {
    my ($domain, $acme_node_config) = @_;

    my $plugin;
    my $alias;
    foreach my $index (keys %$acme_node_config) {
	next if $index eq 'domains';

	my $domain_config = $acme_node_config->{$index};
	if (defined($domain_config->{domain}) &&
	    $domain_config->{domain} eq $domain) {
	    $plugin = $domain_config->{plugin};
	    $alias = $domain_config->{alias};
	    last;
	}
    }
    return "standalone" if !defined($plugin);

    my $plugin_conf = PVE::API2::ACMEPlugin::load_config();
    my $data = $plugin_conf->{ids}->{$plugin};
    my $plugin_type = $data->{type};

    $data->{alias} = $alias;

    return ($plugin_type, $data);
};

my $order_certificate = sub {
    my ($acme, $acme_node_config) = @_;
    print "Placing ACME order\n";
    my ($order_url, $order) = $acme->new_order($acme_node_config->{domains});
    print "Order URL: $order_url\n";
    my $index = 0;
    for my $auth_url (@{$order->{authorizations}}) {
	print "\nGetting authorization details from '$auth_url'\n";
	my $auth = $acme->get_authorization($auth_url);
	my $domain = $auth->{identifier}->{value};
	if ($auth->{status} eq 'valid') {
	    $domain = %{@{$order->{identifiers}}[$index]}{value};
	    print "$domain is already validated!\n";
	} else {
	    print "The validation for $domain is pending!\n";

	    my ($plugin_type, $plugin_config) = &$get_plugin_type($domain, $acme_node_config);

	    my $plugin = PVE::ACME::Challenge->lookup($plugin_type);

	    my $challenge = $plugin->extract_challenge($auth->{challenges});
	    my $key_auth = $acme->key_authorization($challenge->{token});
	    my $data = {
		key_authorization => $key_auth,
		token => $challenge->{token},
		url => $challenge->{url},
		domain => $domain,
	    };

	    foreach my $key (keys %$plugin_config) {
		$data->{plugin}->{$key} = $plugin_config->{$key};
	    }

	    $plugin->setup($data);

	    print "Triggering validation\n";
	    eval {
		$acme->request_challenge_validation($data->{url}, $data->{key_authorization});
		print "Sleeping for 5 seconds\n";
		sleep 5;
		while (1) {
		    $auth = $acme->get_authorization($auth_url);
		    if ($auth->{status} eq 'pending') {
			print "Status is still 'pending', trying again in 30 seconds\n";
			sleep 30;
			next;
		    } elsif ($auth->{status} eq 'valid') {
			print "Status is 'valid'!\n";
			last;
		    }
		    die "validating challenge '$auth_url' failed\n";
		}
	    };
	    my $err = $@;
	    eval { $plugin->teardown($data) };
	    warn "$@\n" if $@;
	    die $err if $err;
	}
	$index++;
    }
    print "\nAll domains validated!\n";
    print "\nCreating CSR\n";
    my ($csr, $key) = PVE::Certificate::generate_csr(identifiers => $order->{identifiers});

    my $finalize_error_cnt = 0;
    print "Checking order status\n";
    while (1) {
	$order = $acme->get_order($order_url);
	if ($order->{status} eq 'pending') {
	    print "still pending, trying to finalize order\n";
	    # FIXME
	    # to be compatible with and without the order ready state
	    # we try to finalize even at the 'pending' state
	    # and give up after 5 unsuccessful tries
	    # this can be removed when the letsencrypt api
	    # definitely has implemented the 'ready' state
	    eval {
		$acme->finalize_order($order, PVE::Certificate::pem_to_der($csr));
	    };
	    if (my $err = $@) {
		die $err if $finalize_error_cnt >= 5;

		$finalize_error_cnt++;
		warn $err;
	    }
	    sleep 5;
	    next;
	} elsif ($order->{status} eq 'ready') {
	    print "Order is ready, finalizing order\n";
	    $acme->finalize_order($order, PVE::Certificate::pem_to_der($csr));
	    sleep 5;
	    next;
	} elsif ($order->{status} eq 'processing') {
	    print "still processing, trying again in 30 seconds\n";
	    sleep 30;
	    next;
	} elsif ($order->{status} eq 'valid') {
	    print "valid!\n";
	    last;
	}
	die "order status: $order->{status}\n";
    }

    print "\nDownloading certificate\n";
    my $cert = $acme->get_certificate($order);

    return ($cert, $key);
};

__PACKAGE__->register_method ({
    name => 'new_certificate',
    path => 'certificate',
    method => 'POST',
    description => "Order a new certificate from ACME-compatible CA.",
    protected => 1,
    proxyto => 'node',
    parameters => {
	additionalProperties => 0,
	properties => {
	    node => get_standard_option('pve-node'),
	    force => {
		type => 'boolean',
		description => 'Overwrite existing custom certificate.',
		optional => 1,
		default => 0,
	    },
	},
    },
    returns => {
	type => 'string',
    },
    code => sub {
	my ($param) = @_;

	my $node = extract_param($param, 'node');
	my $cert_prefix = PVE::CertHelpers::cert_path_prefix($node);

	raise_param_exc({'force' => "Custom certificate exists but 'force' is not set."})
	    if !$param->{force} && -e "${cert_prefix}.pem";

	my $node_config = PVE::NodeConfig::load_config($node);
	my $acme_node_config = PVE::NodeConfig::get_acme_conf($node_config);
	raise("ACME domain list in node configuration is missing!", 400)
	    if !$acme_node_config || !$acme_node_config->{domains};

	my $rpcenv = PVE::RPCEnvironment::get();

	my $authuser = $rpcenv->get_user();

	my $realcmd = sub {
	    STDOUT->autoflush(1);
	    my $account = $acme_node_config->{account} // 'default';
	    my $account_file = "${acme_account_dir}/${account}";
	    die "ACME account config file '$account' does not exist.\n"
		if ! -e $account_file;

	    my $acme = PVE::ACME->new($account_file);

	    print "Loading ACME account details\n";
	    $acme->load();

	    my ($cert, $key) = $order_certificate->($acme, $acme_node_config);

	    my $code = sub {
		print "Setting pveproxy certificate and key\n";
		PVE::CertHelpers::set_cert_files($cert, $key, $cert_prefix, $param->{force});

		print "Restarting pveproxy\n";
		PVE::Tools::run_command(['systemctl', 'reload-or-restart', 'pveproxy']);
	    };
	    PVE::CertHelpers::cert_lock(10, $code);
	    die "$@\n" if $@;
	};

	return $rpcenv->fork_worker("acmenewcert", undef, $authuser, $realcmd);
    }});

__PACKAGE__->register_method ({
    name => 'renew_certificate',
    path => 'certificate',
    method => 'PUT',
    description => "Renew existing certificate from CA.",
    protected => 1,
    proxyto => 'node',
    parameters => {
	additionalProperties => 0,
	properties => {
	    node => get_standard_option('pve-node'),
	    force => {
		type => 'boolean',
		description => 'Force renewal even if expiry is more than 30 days away.',
		optional => 1,
		default => 0,
	    },
	},
    },
    returns => {
	type => 'string',
    },
    code => sub {
	my ($param) = @_;

	my $node = extract_param($param, 'node');
	my $cert_prefix = PVE::CertHelpers::cert_path_prefix($node);

	raise("No current (custom) certificate found, please order a new certificate!\n")
	    if ! -e "${cert_prefix}.pem";

	my $expires_soon = PVE::Certificate::check_expiry("${cert_prefix}.pem", time() + 30*24*60*60);
	raise_param_exc({'force' => "Certificate does not expire within the next 30 days, and 'force' is not set."})
	    if !$expires_soon && !$param->{force};

	my $node_config = PVE::NodeConfig::load_config($node);
	my $acme_node_config = PVE::NodeConfig::get_acme_conf($node_config);
	raise("ACME domain list in node configuration is missing!", 400)
	    if !$acme_node_config || !$acme_node_config->{domains};

	my $rpcenv = PVE::RPCEnvironment::get();

	my $authuser = $rpcenv->get_user();

	my $old_cert = PVE::Tools::file_get_contents("${cert_prefix}.pem");

	my $realcmd = sub {
	    STDOUT->autoflush(1);
	    my $account = $acme_node_config->{account} // 'default';
	    my $account_file = "${acme_account_dir}/${account}";
	    die "ACME account config file '$account' does not exist.\n"
		if ! -e $account_file;

	    my $acme = PVE::ACME->new($account_file);

	    print "Loading ACME account details\n";
	    $acme->load();

	    my ($cert, $key) = $order_certificate->($acme, $acme_node_config);

	    my $code = sub {
		print "Setting pveproxy certificate and key\n";
		PVE::CertHelpers::set_cert_files($cert, $key, $cert_prefix, 1);

		print "Restarting pveproxy\n";
		PVE::Tools::run_command(['systemctl', 'reload-or-restart', 'pveproxy']);
	    };
	    PVE::CertHelpers::cert_lock(10, $code);
	    die "$@\n" if $@;

	    print "Revoking old certificate\n";
            $acme->revoke_certificate($old_cert);
	};

	return $rpcenv->fork_worker("acmerenew", undef, $authuser, $realcmd);
    }});

__PACKAGE__->register_method ({
    name => 'revoke_certificate',
    path => 'certificate',
    method => 'DELETE',
    description => "Revoke existing certificate from CA.",
    protected => 1,
    proxyto => 'node',
    parameters => {
	additionalProperties => 0,
	properties => {
	    node => get_standard_option('pve-node'),
	},
    },
    returns => {
	type => 'string',
    },
    code => sub {
	my ($param) = @_;

	my $node = extract_param($param, 'node');
	my $cert_prefix = PVE::CertHelpers::cert_path_prefix($node);

	my $node_config = PVE::NodeConfig::load_config($node);
	my $acme_node_config = PVE::NodeConfig::get_acme_conf($node_config);
	raise("ACME domain list in node configuration is missing!", 400)
	    if !$acme_node_config || !$acme_node_config->{domains};

	my $rpcenv = PVE::RPCEnvironment::get();

	my $authuser = $rpcenv->get_user();

	my $cert = PVE::Tools::file_get_contents("${cert_prefix}.pem");

	my $realcmd = sub {
	    STDOUT->autoflush(1);
	    my $account = $acme_node_config->{account} // 'default';
	    my $account_file = "${acme_account_dir}/${account}";
	    die "ACME account config file '$account' does not exist.\n"
		if ! -e $account_file;

	    my $acme = PVE::ACME->new($account_file);

	    print "Loading ACME account details\n";
	    $acme->load();

	    print "Revoking old certificate\n";
	    $acme->revoke_certificate($cert);

	    my $code = sub {
		print "Deleting certificate files\n";
		unlink "${cert_prefix}.pem";
		unlink "${cert_prefix}.key";

		print "Restarting pveproxy to revert to self-signed certificates\n";
		PVE::Tools::run_command(['systemctl', 'reload-or-restart', 'pveproxy']);
	    };

	    PVE::CertHelpers::cert_lock(10, $code);
	    die "$@\n" if $@;
	};

	return $rpcenv->fork_worker("acmerevoke", undef, $authuser, $realcmd);
    }});

1;
