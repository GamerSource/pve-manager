package PVE::NodeConfig;

use strict;
use warnings;

use PVE::CertHelpers;
use PVE::JSONSchema qw(get_standard_option);
use PVE::Tools qw(file_get_contents file_set_contents lock_file);
use PVE::ACME;

# register up to 20 domain names
my $MAXDOMAINS = 20;

my $node_config_lock = '/var/lock/pvenode.lock';

PVE::JSONSchema::register_format('pve-acme-domain', sub {
    my ($domain, $noerr) = @_;

    my $label = qr/[a-z0-9][a-z0-9_-]*/i;

    return $domain if $domain =~ /^$label(?:\.$label)+$/;
    return undef if $noerr;
    die "value does not look like a valid domain name";
});

sub config_file {
    my ($node) = @_;

    return "/etc/pve/nodes/${node}/config";
}

sub load_config {
    my ($node) = @_;

    my $filename = config_file($node);
    my $raw = eval { PVE::Tools::file_get_contents($filename); };
    return {} if !$raw;

    return parse_node_config($raw);
}

sub write_config {
    my ($node, $conf) = @_;

    my $filename = config_file($node);

    my $raw = write_node_config($conf);

    PVE::Tools::file_set_contents($filename, $raw);
}

sub lock_config {
    my ($node, $code, @param) = @_;

    my $res = lock_file($node_config_lock, 10, $code, @param);

    die $@ if $@;

    return $res;
}

my $confdesc = {
    description => {
	type => 'string',
	description => 'Node description/comment.',
	optional => 1,
    },
    wakeonlan => {
	type => 'string',
	description => 'MAC address for wake on LAN',
	format => 'mac-addr',
	optional => 1,
    },
    'startall-onboot-delay' => {
	description => 'Initial delay in seconds, before starting all the Virtual Guests with on-boot enabled.',
	type => 'integer',
	minimum => 0,
	maximum => 300,
	default => 0,
	optional => 1,
    },
};

my $acme_additional_desc = {
    domain => {
	type => 'string',
	format => 'pve-acme-domain',
	format_description => 'domain',
	description => 'domain for this node\'s ACME certificate',
    },
    plugin => {
	type => 'string',
	format => 'pve-configid',
	description => 'The plugin ID, default is standalone http',
	format_description => 'name of the plugin configuration',
    },
    alias => {
	type => 'string',
	format => 'pve-acme-domain',
	format_description => 'domain',
	description => 'Alias for the Domain to verify ACME Challenge over DNS',
	optional => 1,
    },
};
PVE::JSONSchema::register_format('pve-acme-additional-node-conf', $acme_additional_desc);

my $acmedesc = {
    account => get_standard_option('pve-acme-account-name'),
    domains => {
	type => 'string',
	format => 'pve-acme-domain-list',
	format_description => 'domain[;domain;...]',
	description => 'List of domains for this node\'s ACME certificate',
	optional => 1,
    },
};
PVE::JSONSchema::register_format('pve-acme-node-conf', $acmedesc);

$confdesc->{acme} = {
    type => 'string',
    description => 'Node specific ACME settings.',
    format => $acmedesc,
    optional => 1,
};

for my $i (0..$MAXDOMAINS) {
    $confdesc->{"acme_additional_domain$i"} = {
	type => 'string',
	description => 'ACME additional Domain',
	format => $acme_additional_desc,
	optional => 1,
    };
};

sub check_type {
    my ($key, $value) = @_;

    die "unknown setting '$key'\n" if !$confdesc->{$key};

    my $type = $confdesc->{$key}->{type};

    if (!defined($value)) {
	die "got undefined value\n";
    }

    if ($value =~ m/[\n\r]/) {
	die "property contains a line feed\n";
    }

    if ($type eq 'boolean') {
	return 1 if ($value eq '1') || ($value =~ m/^(on|yes|true)$/i);
	return 0 if ($value eq '0') || ($value =~ m/^(off|no|false)$/i);
	die "type check ('boolean') failed - got '$value'\n";
    } elsif ($type eq 'integer') {
	return int($1) if $value =~ m/^(\d+)$/;
	die "type check ('integer') failed - got '$value'\n";
    } elsif ($type eq 'number') {
	return $value if $value =~ m/^(\d+)(\.\d+)?$/;
	die "type check ('number') failed - got '$value'\n";
    } elsif ($type eq 'string') {
	if (my $fmt = $confdesc->{$key}->{format}) {
	    PVE::JSONSchema::check_format($fmt, $value);
	    return $value;
	} elsif (my $pattern = $confdesc->{$key}->{pattern}) {
	    if ($value !~ m/^$pattern$/) {
		die "value does not match the regex pattern\n";
	    }
	}
	return $value;
    } else {
	die "internal error"
    }
}

sub parse_node_config {
    my ($content) = @_;

    return undef if !defined($content);

    my $conf = {
	digest => Digest::SHA::sha1_hex($content),
    };
    my $descr = '';

    my @lines = split(/\n/, $content);
    foreach my $line (@lines) {
	if ($line =~ /^\#(.*)\s*$/ || $line =~ /^description:\s*(.*\S)\s*$/) {
	    $descr .= PVE::Tools::decode_text($1) . "\n";
	    next;
	}
	if ($line =~ /^([a-z][a-z-_]*\d*):\s*(\S.*)\s*$/) {
	    my $key = $1;
	    my $value = $2;
	    eval { $value = check_type($key, $value); };
	    warn "cannot parse value of '$key' in node config: $@" if $@;
	    $conf->{$key} = $value;
	} else {
	    warn "cannot parse line '$line' in node config\n";
	}
    }

    $conf->{description} = $descr if $descr;

    return $conf;
}

sub write_node_config {
    my ($conf) = @_;

    my $raw = '';
    # add description as comment to top of file
    my $descr = $conf->{description} || '';
    foreach my $cl (split(/\n/, $descr)) {
	$raw .= '#' .  PVE::Tools::encode_text($cl) . "\n";
    }

    for my $key (sort keys %$conf) {
	next if ($key eq 'description');
	next if ($key eq 'digest');

	my $value = $conf->{$key};
	die "detected invalid newline inside property '$key'\n"
	    if $value =~ m/\n/;
	$raw .= "$key: $value\n";
    }

    return $raw;
}

sub get_acme_conf {
    my ($data, $noerr) = @_;

    $data //= '';

    my $res = {};

    if (defined($data->{acme})) {
	$res = eval {
	    PVE::JSONSchema::parse_property_string($acmedesc, $data->{acme});
	};
	if ($@) {
	    return undef if $noerr;
	    die $@;
	}
	my $standalone_domains = delete($res->{domains}) // '';
	foreach my $domain (split(";", $standalone_domains)) {
	    $res->{domains}->{$domain}->{plugin} = 'standalone';
	}
    }

    $res->{account} //= 'default';

    for my $index (0..$MAXDOMAINS) {
	my $domain_rec = $data->{"acme_additional_domain$index"};
	next if !defined($domain_rec);

	my $parsed = eval {
	    PVE::JSONSchema::parse_property_string(
		$acme_additional_desc,
		$domain_rec);
	};
	if ($@) {
	    return undef if $noerr;
	    die $@;
	}
	my $domain = delete $parsed->{domain};
	if ($res->{domains}->{$domain}) {
	    return undef if $noerr;
	    die "duplicate ACME config for domain '$domain'\n";
	}
	$res->{domains}->{$domain} = $parsed;
    }

    return $res;
}

sub get_nodeconfig_schema {

    return $confdesc;
}

1;
