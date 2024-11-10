import { RPM } from "../path.js"
import { THREE } from "../../System/Globals.js";

const pluginName = "Particle effects";

const clock = new THREE.Clock();
const loader = new THREE.TextureLoader();
const dummy = new THREE.Object3D();
const emitterList = [];

const vertShader = `
attribute float instanceAlpha;

varying float alpha;
varying vec2 vUV;

void main()
{
	//gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	vUV = vec3(uv, 1).xy;
	alpha = instanceAlpha;
}`;

const fragShader = `
uniform sampler2D diffuseTexture;

varying float alpha;
varying vec2 vUV;

void main()
{
	vec4 tex = texture2D(diffuseTexture, vec2(vUV.x, vUV.y));
	tex.a = alpha;
	gl_FragColor = tex;
}`;

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
	static ROUND = 17;
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
	const expr = [];
	for (var i = 0; i < text.length; i++)
	{
		if (text[i] == '+')
			expr.push({ token: Token.ADD, type: "op", value: null });
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
		{
			if (text[++i] == 'o')
			{
				if (text[++i] == 'u')
				{
					if (text[++i] == 'n')
					{
						if (text[++i] == 'd')
							expr.push({ token: Token.ROUND, type: "func", value: null });
						else
							return null;
					}
					else
						return null;
				}
				else
					return null;
			}
			else
			{
				expr.push({ token: Token.RAND, type: "val", value: null });
				i--;
			}
		}
		else
		{
			var num = "";
			while (num.search(/^-?\d*(\.\d*)?$/) === 0 && i < text.length)
				num += text[i++].toString();
			if (i < text.length)
			{
				num = num.slice(0, -1);
				i--;
			}
			i--;
			if (num.length > 0)
			{
				if (num == '-')
					expr.push({ token: Token.SUB, type: "op", value: null });
				else
					expr.push({ token: Token.NUM, type: "val", value: parseFloat(num) });
			}
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

function evaluate(expr, t, r)
{
	switch (expr.token)
	{
		case Token.ADD:   return evaluate(expr.left, t, r) + evaluate(expr.right, t, r);
		case Token.SUB:   return evaluate(expr.left, t, r) - evaluate(expr.right, t, r);
		case Token.MULT:  return evaluate(expr.left, t, r) * evaluate(expr.right, t, r);
		case Token.DIV:   return evaluate(expr.left, t, r) / evaluate(expr.right, t, r);
		case Token.MOD:   return evaluate(expr.left, t, r) % evaluate(expr.right, t, r);
		case Token.POW:   return Math.pow(evaluate(expr.left, t, r), evaluate(expr.right, t, r));
		case Token.SQRT:  return Math.sqrt(evaluate(expr.left, t, r));
		case Token.LN:    return Math.log(evaluate(expr.left, t, r));
		case Token.SIN:   return Math.sin(evaluate(expr.left, t, r));
		case Token.COS:   return Math.cos(evaluate(expr.left, t, r));
		case Token.TAN:   return Math.tan(evaluate(expr.left, t, r));
		case Token.ABS:   return Math.abs(evaluate(expr.left, t, r));
		case Token.ROUND: return Math.round(evaluate(expr.left, t, r));
		case Token.TIME:  return t;
		case Token.RAND:  return r;
		case Token.NUM:   return expr.value;
		default:          return null;
	}
}

setInterval(function ()
{
	if (RPM.Manager.Stack.top instanceof RPM.Scene.Map && !RPM.Scene.Map.current.loading)
	{
		const delta = clock.getDelta();
		for (var i = 0; i < emitterList.length; i++)
		{
			const e = emitterList[i];
			if (e.map === RPM.Scene.Map.current && !!e.mesh.parent)
			{
				e.emissionTime += delta;
				if (e.rate > 0 && e.emissionTime > e.nextEmission)
				{
					e.nextEmission = e.emissionTime + (1 + Math.random()) / (2 * e.rate);
					e.particles.push({ time: 0, rand: Math.random() });
				}
				for (var j = 0; j < e.maxParticles; j++)
				{
					if (j < e.particles.length)
					{
						const p = e.particles[j];
						p.time += delta;
						dummy.position.set(evaluate(e.px, p.time, p.rand), evaluate(e.py, p.time, p.rand), evaluate(e.pz, p.time, p.rand)).multiplyScalar(RPM.Datas.Systems.SQUARE_SIZE);
						dummy.scale.set(1, 1, 1).multiplyScalar(size);
						e.instanceAlpha[j] = evaluate(e.opacity, p.time, p.rand);
						dummy.updateMatrix();
						e.mesh.setMatrixAt(j, dummy.matrix);
					}
					else
					{
						dummy.position.set(0, 0, 0);
						dummy.scale.set(0, 0, 0);
						dummy.updateMatrix();
						e.mesh.setMatrixAt(j, dummy.matrix);
					}
				}
				e.mesh.geometry.setAttribute("instanceAlpha", new THREE.InstancedBufferAttribute(e.instanceAlpha, 1));
				e.mesh.geometry.attributes.instanceAlpha.needsUpdate = true;
				e.mesh.instanceMatrix.needsUpdate = true;
			}
			else
				emitterList.splice(i--, 1);
		}
	}
}, 16);

RPM.Manager.Plugins.registerCommand(pluginName, "Start particle effect", (object, rate, lifespan, position, size, opacity, texture, additiveBlending) =>
{
	RPM.Core.MapObject.search(object, (result) =>
	{
		const tex = loader.load(texture);
		const maxParticles = rate * lifespan;
		const geo = new THREE.PlaneGeometry(tex.image.width, tex.image.height);
		const mat = new THREE.ShaderMaterial({ uniforms: { diffuseTexture: tex }});
		const mesh = new THREE.InstancedMesh(geo, mat, maxParticles);
		result.object.mesh.add(mesh);
		position = position.split(";");
		emitterList.push(
		{
			id: object,
			emissionTime: 0,
			nextEmission: 0,
			maxParticles: maxParticles,
			map: RPM.Scene.Map.current,
			instanceAlpha: new Float32Array(maxParticles),
			mesh: mesh,
			particles: [],
			blending: additiveBlending ? THREE.AdditiveBlending : THREE.NormalBlending,
			rate: rate,
			lifespan: lifespan,
			px: tokenize(position[0]),
			py: tokenize(position[1]),
			pz: tokenize(position[2]),
			size: tokenize(size),
			opacity: tokenize(opacity)
		});
	}, RPM.Core.ReactionInterpreter.currentObject);
	console.log(opacity, tokenize(opacity));
});

RPM.Manager.Plugins.registerCommand(pluginName, "End particle effect", (object, smooth) =>
{
	for (var i = 0; i < emitterList.length; i++)
	{
		const e = emitterList[i];
		if (e.id === object)
		{
			e.rate = 0;
			setTimeout(function ()
			{
				e.mesh.parent.remove(e.mesh);
			}, smooth ? e.lifespan * 1000 : 1);
			break;
		}
	}
});