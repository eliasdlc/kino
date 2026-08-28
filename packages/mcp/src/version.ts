/**
 * La versión que el servidor MCP le dice al cliente en el handshake.
 *
 * Existe porque estaba escrita a mano en dos sitios y ya se habían separado: el
 * servidor stdio decía 2.6.0 y la ruta remota 2.4.0, así que la misma superficie
 * de tools se anunciaba distinta según por dónde entraras.
 *
 * Se mantiene igual a la de `package.json`, y un test lo comprueba en vez de
 * confiar en que alguien se acuerde.
 */
export const MCP_SERVER_VERSION = '2.7.0';
