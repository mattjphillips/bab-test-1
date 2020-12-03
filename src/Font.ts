import * as OpenType from "opentype.js";
import { Shape, Transform } from "./Shape";
import { ShapeGroup } from "./ShapeGroup";
import { GlyphPathConverter } from "./GlyphPathConverter";

/** A source of paths. */
export class Font {

    private _readyPromise: Promise<Font>;
    private _font: OpenType.Font;

    constructor(public readonly otfURL: string, public readonly name: string) {
        this._readyPromise = OpenType.load(this.otfURL).then(f => {
            this._font = f;
            return this;
        });
    }

    ready(): Promise<Font> {
        return this._readyPromise;
    }

    glyphMap: { [name: string]: { glyph: OpenType.Glyph, shape: Shape }} = {};

    getGlyphShape(otGlyph: OpenType.Glyph): Shape {
        let inf = this.glyphMap[otGlyph.name];
        
        if (!inf) {
            const path: OpenType.Path = otGlyph.path instanceof OpenType.Path ? otGlyph.path : otGlyph.path();
            const shape = GlyphPathConverter.shapeForPath(`${this.name}-${otGlyph.index}`, path);
            inf = { glyph: otGlyph, shape };
            this.glyphMap[otGlyph.name] = inf;
        }

        return inf.shape;
    }

    createShapeForText(text: string, xform: Transform): Shape {

        const otGlyphs = this._font.stringToGlyphs(text);

        const scale = 1 / this._font.unitsPerEm;

        let x = 0;
        let prevGlyph: OpenType.Glyph = null;

        const shapes = otGlyphs.map(g => {
            const shape = this.getGlyphShape(g);
            if (prevGlyph) {
                x += this._font.getKerningValue(prevGlyph, g);
            }
            
            const xform = shape.xform.concat(new Transform(x * scale, 0, 0, scale));
            x += g.advanceWidth;
            prevGlyph = g;
            return shape.withXform(xform);
        });

        return new ShapeGroup(shapes, xform);
    }
}

