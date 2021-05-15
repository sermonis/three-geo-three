import {BufferGeometry, Camera, Group, Material, Mesh, MeshBasicMaterial, Object3D, Raycaster, Scene, WebGLRenderer} from 'three';
import {MapSphereNodeGeometry} from './geometries/MapSphereNodeGeometry';
import {OpenStreetMapsProvider} from './providers/OpenStreetMapsProvider';
import {MapNode} from './nodes/MapNode';
import {MapHeightNode} from './nodes/MapHeightNode';
import {MapPlaneNode} from './nodes/MapPlaneNode';
import {MapSphereNode} from './nodes/MapSphereNode';
import {UnitsUtils} from './utils/UnitsUtils';
import {MapHeightNodeShader} from './nodes/MapHeightNodeShader';
import {LODRaycast} from './lod/LODRaycast';
import {MapProvider} from './providers/MapProvider';
import {LODControl} from './lod/LODControl';

/**
 * Map viewer is used to read and display map tiles from a server.
 *
 * It was designed to work with a OpenMapTiles but can also be used with another map tiles.
 *
 * The map is drawn in plane map nodes using a quad tree that is subdivided as necessary to guaratee good map quality.
 */
export class MapView extends Mesh 
{
	/**
	 * Planar map projection.
	 */
	public static PLANAR: number = 200;

	/**
	 * Spherical map projection.
	 */
	public static SPHERICAL: number = 201;

	/**
	 * Planar map projection with height deformation.
	 */
	public static HEIGHT: number = 202;

	/**
	 * Planar map projection with height deformation using the GPU for height generation.
	 */
	public static HEIGHT_SHADER: number = 203;

	/**
	 * Map of the map node types available.
	 */
	public static mapModes: Map<number, any> = new Map<number, any>([
		[MapView.PLANAR, MapPlaneNode],
		[MapView.SPHERICAL, MapSphereNode],
		[MapView.HEIGHT, MapHeightNode],
		[MapView.HEIGHT_SHADER, MapHeightNodeShader]
	]);

	/**
	 * LOD control object used to defined how tiles are loaded in and out of memory.
	 */
	public lod: LODControl;

	/**
	 * Map tile color layer provider.
	 */
	public provider: MapProvider;

	/**
	 * Map height (terrain elevation) layer provider.
	 */
	public heightProvider: MapProvider;

	/**
	 * Define the type of map node in use, defined how the map is presented.
	 *
	 * Should only be set on creation.
	 */
	public root: MapNode;

	/**
	 * Constructor for the map view objects.
	 *
	 * @param root - Map view node modes can be SPHERICAL, HEIGHT or PLANAR. PLANAR is used by default. Can also be a custom MapNode instance.
	 * @param provider - Map color tile provider by default a OSM maps provider is used if none specified.
	 * @param heightProvider - Map height tile provider, by default no height provider is used.
	 */
	public constructor(root: (number | MapNode), provider: MapProvider, heightProvider: MapProvider) 
	{
		super(undefined, new MeshBasicMaterial({transparent: true, opacity: 0.0}));

		this.lod = new LODRaycast();

		this.provider = provider !== undefined ? provider : new OpenStreetMapsProvider();

		this.heightProvider = heightProvider !== undefined ? heightProvider : null;

		// @ts-ignore
		this.root = root !== undefined ? root : MapView.PLANAR;
		this.setRoot(root);
	}

	/**
	 * Set the root of the map view.
	 *
	 * Is set by the constructor by default, can be changed in runtime.
	 *
	 * @param root - Map node to be used as root.
	 */
	public setRoot(root: (MapNode | number)): void
	{
		if (typeof root === 'number') 
		{
			if (!MapView.mapModes.has(root)) 
			{
				throw new Error('Map mode ' + root + ' does is not registered.');
			}

			const rootConstructor = MapView.mapModes.get(root) as typeof MapNode;

			// @ts-ignore
			root = new root.constructor(null, null, null, this, MapNode.ROOT, 0, 0, 0);
		}

		if (this.root !== null) 
		{
			this.remove(this.root);
			this.root = null;
		}

		// @ts-ignore
		this.root = root;

		// @ts-ignore
		this.geometry = this.root.constructor.BASE_GEOMETRY;

		// @ts-ignore
		this.scale.copy(this.root.constructor.BASE_SCALE);

		this.root.mapView = this;
		this.add(this.root);
	}

	/**
	 * Change the map provider of this map view.
	 *
	 * Will discard all the tiles already loaded using the old provider.
	 */
	public setProvider(provider: MapProvider): void
	{
		if (provider !== this.provider) 
		{
			this.provider = provider;
			this.clear();
		}
	}

	/**
	 * Change the map height provider of this map view.
	 *
	 * Will discard all the tiles already loaded using the old provider.
	 */
	public setHeightProvider(heightProvider: MapProvider): void
	{
		if (heightProvider !== this.heightProvider) 
		{
			this.heightProvider = heightProvider;
			this.clear();
		}
	}

	/**
	 * Clears all tiles from memory and reloads data. Used when changing the provider.
	 *
	 * Should be called manually if any changed to the provider are made without setting the provider.
	 */
	public clear(): any
	{
		this.traverse(function(children: Object3D): void
		{
			// @ts-ignore
			if (children.childrenCache) 
			{
				// @ts-ignore
				children.childrenCache = null;
			}

			// @ts-ignore
			if (children.loadTexture !== undefined) 
			{
				// @ts-ignore
				children.loadTexture();
			}
		});

		return this;
	}

	/**
	 * Ajust node configuration depending on the camera distance.
	 *
	 * Called everytime before render.
	 */
	public onBeforeRender: (renderer: WebGLRenderer, scene: Scene, camera: Camera, geometry: BufferGeometry, material: Material, group: Group)=> void = (renderer, scene, camera, geometry, material, group) => 
	{
		this.lod.updateLOD(this, camera, renderer, scene);
	};

	/**
	 * Get map meta data from server if supported.
	 */
	public getMetaData(): void
	{
		this.provider.getMetaData();
	}

	public raycast(raycaster: Raycaster, intersects: any[]): boolean
	{
		return false;
	}
}
