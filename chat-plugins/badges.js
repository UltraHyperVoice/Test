/*
* Credits: Niisama
*/

'use strict';

function badgeImg(IMG_URL, name) {
	return '<img src="' + IMG_URL + '" height="16" width="16" alt="' + name + '" title="' + name + '" >';
}

exports.commands = {
	badge: 'badges',
	badges: function (target, room, user) {
		const tr_css = 'style ="background: rgba(69, 76, 80, 0.8);border: 3px solid #FFF ;border-radius: 4px"';
		const td_css = 'style ="background: rgba(69, 76, 80, 0.6);color: #FFF;padding: 5px;border: 1px solid #222;border: 3px solid #FFF;border-radius: 4px"';
		let parts = target.split(',');
		let cmd = parts[0].trim().toLowerCase();
		let targetUser;
		let selectedBadge;
		let userBadges;
		let output = '';
		switch (cmd) {
		case 'give':
		case 'set':
			if (!this.can('lock')) return false;
			if (parts.length !== 3) return this.errorReply("Correct command: `/Poner medalla, [usuario], [nombredeMedalla]`");
			let userid = toId(parts[1].trim());
			targetUser = Users.getExact(userid);
			userBadges = Db('userBadges').get(userid);
			selectedBadge = parts[2].trim();
			if (!Db('badgeData').has(selectedBadge)) return this.errorReply("Esta medalla no existe, por favor checa /Listamedalla");
			if (!Db('userBadges').has(userid)) userBadges = [];
			userBadges = userBadges.filter(b => b !== selectedBadge);
			userBadges.push(selectedBadge);
			Db('userBadges').set(userid, userBadges);
			if (Users.get(targetUser)) Users.get(userid).popup('|modal||html|Has recibido una Medalla de ' + EM.nameColor(toId(user), true) + ': <img src="' + Db('badgeData').get(selectedBadge)[1] + '" width="16" height="16"> (' + selectedBadge + ')');
			this.logModCommand(user.name + " Dio la medalla '" + selectedBadge + "' a " + userid + ".");
			this.sendReply("La '" + selectedBadge + "' medalla a sido dada a '" + userid + "'.");
			break;
		case 'create':
			if (!this.can('ban')) return false;
			if (parts.length !== 4) return this.errorReply("Correct command: `/Crear medalla, [badge name], [description], [image]`.");
			let badgeName = Chat.escapeHTML(parts[1].trim());
			let description = Chat.escapeHTML(parts[2].trim());
			let img = parts[3].trim();
			if (Db('badgeData').has(badgeName)) return this.errorReply('Esta medalla ya existe.');
			Db('badgeData').set(badgeName, [description, img]);
			this.logModCommand(user.name + " a creado la metalla '" + badgeName + ".");
			Users.get(user.userid).popup('|modal||html|Has creado correctamente la medalla ' + badgeName + '<img src ="' + img + '" width="16" height="16">');
			break;
		case 'list':
			if (!this.runBroadcast()) return;
			output = '<table>';
			Object.keys(Db('badgeData').object()).forEach(badge => {
				let badgeData = Db('badgeData').get(badge);
				output += '<tr ' + tr_css + '> <td ' + td_css + '>' + badgeImg(badgeData[1], badge) + '</td> <td ' + td_css + '>' + badge + '</td> <td ' + td_css + '>' + badgeData[0] + '</td></tr>';
			});
			output += '</table>';
			this.sendReply('|html|<div class = "infobox' + (this.broadcasting ? '-limited' : '') + '">' + output + '</div>');
			break;
		case 'info':
			if (!this.runBroadcast()) return;
			if (!parts[1]) return this.parse('/medallas');
			selectedBadge = parts[1].trim();
			if (!Db('badgeData').has(selectedBadge)) return this.errorReply("Esta medalla no existe, por favor checa /Listamedalla");
			let badgeData = Db('badgeData').get(selectedBadge);
			this.sendReplyBox('<table><tr ' + tr_css + '> <td ' + td_css + '>' + badgeImg(badgeData[1], selectedBadge) + '</td> <td ' + td_css + '>' + selectedBadge + '</td> <td ' + td_css + '>' + badgeData[0] + '</td></tr></table>');
			break;
		case 'take':
			if (!this.can('lock')) return false;
			if (parts.length !== 3) return this.errorReply("Correct command: `/Quitar medalla, usuario, nombre de medalla`");
			let userId = toId(parts[1].trim());
			if (!Db('userBadges').has(userId)) return this.errorReply("Este usuario no tiene medalla.");
			userBadges = Db('userBadges').get(userId);
			selectedBadge = parts[2].trim();
			userBadges = userBadges.filter(b => b !== selectedBadge);
			Db('userBadges').set(userId, userBadges);
			this.logModCommand(user.name + " Tomó la insignia '" + selectedBadge + "' de " + userId + ".");
			this.sendReply("The '" + selectedBadge + "' La insignia fue tomada de '" + userId + "'.");
			Users.get(userId).popup('|modal||html|' + EM.nameColor(user.name, true) + ' Ha tomado la ' + selectedBadge + ' medalla. <img src="' + Db('badgeData').get(selectedBadge)[1] + '" width="16" height="16">');
			break;
		case 'delete':
			if (!this.can('ban')) return false;
			if (parts.length !== 2) return this.errorReply("Correct command: `/Borrar medalla, nombredemedalla`");
			selectedBadge = parts[1].trim();
			if (!Db('badgeData').has(selectedBadge)) return this.errorReply("Esta medalla no existe, por favor checa /Listamedalla");
			Db('badgeData').delete(selectedBadge);
			let badgeUserObject = Db('userBadges').object();
			Users.users.forEach(u => Db('userBadges').set(u, (badgeUserObject[u].filter(b => b !== selectedBadge))));
			this.sendReply("The badge with the name '" + selectedBadge + "' deleted.");
			this.logModCommand(user.name + " removed the badge '" + selectedBadge + ".");
			break;
		case 'user':
			if (!parts[1]) return this.errorReply('El usuario no a sido bien especificado.');

			if (!this.runBroadcast()) return;
			let userID = toId(parts[1].trim());
			if (!Db('userBadges').has(userID)) return this.errorReply("Este usuario no tiene medallas.");
			output = '<table>';
			let usersBadges = Db('userBadges').get(userID);
			for (let i in usersBadges) {
				let badgeData = Db('badgeData').get(usersBadges[i]);
				output += '<tr ' + tr_css + '><td ' + td_css + '>' + badgeImg(badgeData[1], usersBadges[i]) + '</td> <td ' + td_css + '>' + usersBadges[i] + '</td> <td ' + td_css + '>' + badgeData[0] + '</td><tr>';
			}
			output += '<table>';
			this.sendReply('|html|<div class = "infobox' + (this.broadcasting ? '-limited' : '') + '">' + output + '</div>');

			break;
		default:
			return this.parse('/help badges');
		}
	},
	badgeshelp: ["/medallas - Acepta los siguientes comandos:",
		"/Lista medalla - Lista de medallas.",
		"/Info medalla, [nombredemedalla] - Obtiene informacion de una medallas especifica.",
		"/Crear medalla, [nombredemedalla], [descripcion], [imagen] - Crea una medalla. Necesitas @, &, or ~",
		"/Borrar medalla, [medalla] - Borra una medalla. Necesitas @, &, or ~",
		"/Poner medalla, [usuario], [nombredemedalla] - Da a un usuario una medalla. Necesitas Global%, Global @, &, o ~ ",
		"/Quitar medalla, [usuario], [nombredemedalla] - Toma una medalla de un usuario. Necesitas Global %, @, &, o ~",
		"/Medalla usuario, [usuario] - Ve las medallas de un usuario."],
};
