export function makeElementName( name: string )
{
	return `rtr-${name}`;
}

export function isCustomElementName( name: any )
{
	return typeof name === 'string' && name.startsWith( 'rtr-' );
}
