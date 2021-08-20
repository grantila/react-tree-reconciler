export function arrayify< T >( arr?: T[ ] | T | null | undefined | void ): T[ ]
{
	if ( arr == null )
		return [ ];
	return Array.isArray( arr ) ? arr : [ arr ];
}
