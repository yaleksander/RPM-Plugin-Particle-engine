import { RPM } from "../path.js"
import { THREE } from "../../System/Globals.js";

const pluginName = "Particle effects";

class Token
{
	static ADD   =  0;
	static SUB   =  1;
	static MULT  =  2;
	static DIV   =  3;
	static MOD   =  4;
	static OPEN  =  5;
	static CLOSE =  6;
	static LN    =  7;
	static SIN   =  8;
	static COS   =  9;
	static TAN   = 10;
	static ABS   = 11;
	static TIME  = 12;
	static RAND  = 13;
	static NUM   = 14;
	static SQRT  = 15;
	static POW   = 16;
}

function tokenize(text)
{
	text = text.toLowerCase();
	while (text.search(" ") !== -1)
		text = text.replace(" ", "");
	while (text.search("\t") !== -1)
		text = text.replace("\t", "");
	while (text.search("\n") !== -1)
		text = text.replace("\n", "");
	text.replace("-", "-1*");
	const expr = [];
	for (var i = 0; i < text.length; i++)
	{
		if (text[i] == '+')
			expr.push({ token: Token.ADD, type: "op", value: null });
		else if (text[i] == '-')
			expr.push({ token: Token.SUB, type: "op", value: null });
		else if (text[i] == '*')
		{
			if (text[++i] == '*')
				expr.push({ token: Token.POW, type: "op", value: null });
			else
			{
				expr.push({ token: Token.MULT, type: "op", value: null });
				i--;
			}
		}
		else if (text[i] == '/')
			expr.push({ token: Token.DIV, type: "op", value: null });
		else if (text[i] == '%')
			expr.push({ token: Token.MOD, type: "op", value: null });
		else if (text[i] == '(')
			expr.push({ token: Token.OPEN, type: null, value: null });
		else if (text[i] == ')')
			expr.push({ token: Token.CLOSE, type: null, value: null });
		else if (text[i] == 'l')
		{
			if (text[++i] == 'n')
				expr.push({ token: Token.LN, type: "func", value: null });
			else
				return null;
		}
		else if (text[i] == 's')
		{
			if (text[++i] == 'i')
			{
				if (text[++i] == 'n')
					expr.push({ token: Token.SIN, type: "func", value: null });
				else
					return null;
			}
			else if (text[++i] == 'q')
			{
				if (text[++i] == 'r')
				{
					if (text[++i] == 't')
						expr.push({ token: Token.SQRT, type: "func", value: null });
					else
						return null;
				}
				else
					return null;
			}
			else
				return null;
		}
		else if (text[i] == 'c')
		{
			if (text[++i] == 'o')
			{
				if (text[++i] == 's')
					expr.push({ token: Token.COS, type: "func", value: null });
				else
					return null;
			}
			else
				return null;
		}
		else if (text[i] == 'a')
		{
			if (text[++i] == 'b')
			{
				if (text[++i] == 's')
					expr.push({ token: Token.ABS, type: "func", value: null });
				else
					return null;
			}
			else
				return null;
		}
		else if (text[i] == 't')
		{
			if (text[++i] == 'a')
			{
				if (text[++i] == 'n')
					expr.push({ token: Token.TAN, type: "func", value: null });
				else
					return null;
			}
			else
			{
				expr.push({ token: Token.TIME, type: "val", value: null });
				i--;
			}
		}
		else if (text[i] == 'r')
			expr.push({ token: Token.RAND, type: "val", value: null });
		else
		{
			var num = "";
			while (num.search(/^\d*(\.\d*)?$/) === 0 && i < text.length)
				num += text[i++].toString();
			if (i < text.length)
			{
				num = num.slice(0, -1);
				i--;
			}
			i--;
			if (num.length > 0)
				expr.push({ token: Token.NUM, type: "val", value: parseFloat(num) });
			else
				return null;
		}
	}
	var par = 0;
	for (var i = 0; i < expr.length; i++)
	{
		if (expr[i].token === Token.OPEN)
		{
			if (i < expr.length - 1 && expr[i + 1].token === Token.CLOSE)
				return null;
			else
				par++;
		}
		else if (expr[i].token === Token.CLOSE)
			par--;
		else if (i < expr.length - 1)
		{
			if (expr[i].type === expr[i + 1].type)
				return null;
			if (expr[i].type == "func" && expr[i + 1].type !== null)
				return null;
		}
		if (par < 0)
			return null;
	}
	if (par === 0)
		return buildTree(expr);
	return null;
}

function buildTree(expr)
{
	if (expr[0].type == "op" || expr[expr.length - 1].type == "op")
		return null;
	var tree = [];
	for (var i = 0; i < expr.length; i++)
	{
		if (expr[i].token === Token.OPEN)
		{
			var nested = [];
			var j = 0;
			while (expr[++j + i].token !== Token.CLOSE)
				nested.push(expr[i + j]);
			var node = buildTree(nested);
			if (!node)
				return null;
			tree.push(node);
			i += j;
		}
		else
			tree.push(expr[i]);
	}
	for (var i = 0; i < tree.length; i++)
	{
		if (!tree[i])
			return null;
		if (tree[i].type == "func")
			tree[i].left = tree.splice(i + 1, 1)[0];
	}
	for (var i = 0; i < tree.length; i++)
	{
		if (tree[i].token === Token.POW)
		{
			tree[i].left = tree.splice(--i, 1)[0];
			tree[i].right = tree.splice(i + 1, 1)[0];
		}
	}
	for (var i = 0; i < tree.length; i++)
	{
		if (tree[i].token === Token.MULT || tree[i].token === Token.DIV || tree[i].token === Token.MOD)
		{
			tree[i].left = tree.splice(--i, 1)[0];
			tree[i].right = tree.splice(i + 1, 1)[0];
		}
	}
	for (var i = 0; i < tree.length; i++)
	{
		if (tree[i].token === Token.ADD || tree[i].token === Token.SUB)
		{
			tree[i].left = tree.splice(--i, 1)[0];
			tree[i].right = tree.splice(i + 1, 1)[0];
		}
	}
	return tree[0];
}

function evaluate(expr)
{
	
}

RPM.Manager.Plugins.registerCommand(pluginName, "Start particle effect", (object, rate, lifespan, position, size, opacity, texture, additiveBlending) =>
{
	console.log(opacity, tokenize(opacity));
});

RPM.Manager.Plugins.registerCommand(pluginName, "End particle effect", (object, smooth) =>
{
	
});