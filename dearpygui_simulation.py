"""
Interactive 2D N-Body Simulation with Dear PyGui
==============================================

A modern, GPU-accelerated version of the N-body simulation.
"""

import dearpygui.dearpygui as dpg
import math
from dataclasses import dataclass, field
from typing import List, Tuple, Optional
import json
import time

# --- Constants ---
SIM_WIDTH = 1200
SIM_HEIGHT = 800
PANEL_WIDTH = 300
VIEWPORT_WIDTH = SIM_WIDTH + PANEL_WIDTH
VIEWPORT_HEIGHT = SIM_HEIGHT

# --- Data Classes (same as before) ---
@dataclass
class Body:
    """Represents a gravitational body in the simulation"""
    id: int
    x: float
    y: float
    vx: float
    vy: float
    mass: float
    radius: float
    color: Tuple[int, int, int]
    trail: List[Tuple[float, float]] = field(default_factory=list)
    max_trail_length: int = 50
    force_x: float = 0.0
    force_y: float = 0.0

    def get_display_radius(self) -> int:
        """Get radius for display (minimum 3 pixels, scales with mass)"""
        return max(3, int(math.sqrt(self.mass / 5) + 2))

# --- Main Simulation Class ---
class NBodySimulatorDearPyGui:
    def __init__(self):
        self.bodies: List[Body] = []
        self.next_body_id = 0
        self.selected_body: Optional[Body] = None
        
        self.simulating = False
        self.paused = False
        
        # Simulation parameters
        self.time_scale = 1.0
        self.gravity_strength = 1.0
        self.collision_enabled = True
        
        # Default body properties
        self.default_mass = 50.0
        self.default_vx = 0.0
        self.default_vy = 0.0
        
        # Camera/View
        self.camera_x = 0
        self.camera_y = 0
        self.zoom = 1.0
        
        # Navigation state
        self.panning = False
        self.last_mouse_x = 0
        self.last_mouse_y = 0
        self.dragging_body = False
        self.drag_offset_x = 0
        self.drag_offset_y = 0

        self.setup_dpg()

    def setup_dpg(self):
        """Sets up the Dear PyGui viewport and windows"""
        dpg.create_context()

        # Control Panel
        with dpg.window(label="Control Panel", width=PANEL_WIDTH, height=VIEWPORT_HEIGHT, no_move=True, no_resize=True, no_close=True) as self.control_panel:
            dpg.add_text("Interactive N-Body Simulation", color=(100, 200, 255))
            dpg.add_separator()
            
            # Simulation controls
            dpg.add_text("Simulation Controls:")
            with dpg.group(horizontal=True):
                dpg.add_button(label="Start", callback=self.start_simulation, tag="start_btn", width=60)
                dpg.add_button(label="Pause", callback=self.pause_simulation, tag="pause_btn", width=60)
                dpg.add_button(label="Reset", callback=self.reset_simulation, tag="reset_btn", width=60)
            
            dpg.add_separator()
            
            # Body properties
            dpg.add_text("New Body Properties:")
            dpg.add_slider_float(label="Mass", default_value=self.default_mass, min_value=1.0, max_value=200.0,
                               callback=self.update_mass, tag="mass_slider", width=200)
            dpg.add_slider_float(label="Velocity X", default_value=self.default_vx, min_value=-100.0, max_value=100.0,
                               callback=self.update_vx, tag="vx_slider", width=200)
            dpg.add_slider_float(label="Velocity Y", default_value=self.default_vy, min_value=-100.0, max_value=100.0,
                               callback=self.update_vy, tag="vy_slider", width=200)
            
            dpg.add_separator()
            
            # Physics settings
            dpg.add_text("Physics Settings:")
            dpg.add_slider_float(label="Time Scale", default_value=self.time_scale, min_value=0.1, max_value=3.0,
                               callback=self.update_time_scale, tag="time_slider", width=200)
            dpg.add_slider_float(label="Gravity", default_value=self.gravity_strength, min_value=0.1, max_value=5.0,
                               callback=self.update_gravity, tag="gravity_slider", width=200)
            dpg.add_checkbox(label="Collisions", default_value=self.collision_enabled,
                           callback=self.toggle_collisions, tag="collision_checkbox")
            
            dpg.add_separator()
            
            # View controls
            dpg.add_text("View Controls:")
            with dpg.group(horizontal=True):
                dpg.add_button(label="Center", callback=self.center_view, width=60)
                dpg.add_button(label="Clear", callback=self.clear_all, width=60)
            
            dpg.add_separator()
            
            # Info display
            dpg.add_text("Statistics:")
            dpg.add_text("Bodies: 0", tag="body_count")
            dpg.add_text("FPS: 60", tag="fps_display")
            dpg.add_text("Mouse: (0, 0)", tag="mouse_pos")
            
            dpg.add_separator()
            dpg.add_text("Instructions:", color=(255, 255, 100))
            dpg.add_text("• Left click: Add/Select/Drag body", wrap=250)
            dpg.add_text("• Right click: Select body only", wrap=250)
            dpg.add_text("• Middle click+drag: Pan view", wrap=250)
            dpg.add_text("• Scroll: Zoom in/out", wrap=250)

        # Simulation canvas
        with dpg.window(label="Simulation", width=SIM_WIDTH, height=VIEWPORT_HEIGHT, no_move=True, no_resize=True, no_close=True, pos=[PANEL_WIDTH, 0]):
            with dpg.drawlist(width=SIM_WIDTH, height=SIM_HEIGHT, tag="simulation_canvas"):
                # Add grid background
                self.draw_grid()

        # Mouse handler for simulation canvas
        with dpg.handler_registry():
            dpg.add_mouse_click_handler(callback=self.mouse_click_handler)
            dpg.add_mouse_release_handler(callback=self.mouse_release_handler)
            dpg.add_mouse_move_handler(callback=self.mouse_move_handler)
            dpg.add_mouse_wheel_handler(callback=self.mouse_wheel_handler)
            dpg.add_mouse_drag_handler(callback=self.mouse_drag_handler)

        dpg.create_viewport(title='Dear PyGui N-Body Simulation', width=VIEWPORT_WIDTH, height=VIEWPORT_HEIGHT)
        dpg.setup_dearpygui()
        dpg.show_viewport()

    def start_simulation(self):
        self.simulating = True
        self.paused = False

    def pause_simulation(self):
        self.paused = not self.paused

    def reset_simulation(self):
        self.bodies = []
        self.next_body_id = 0
        self.selected_body = None
        self.simulating = False
        self.paused = False
        self.camera_x = 0
        self.camera_y = 0
        self.zoom = 1.0

    def clear_all(self):
        self.bodies = []
        self.next_body_id = 0
        self.selected_body = None

    def center_view(self):
        if self.bodies:
            # Center on center of mass
            total_mass = sum(body.mass for body in self.bodies)
            center_x = sum(body.x * body.mass for body in self.bodies) / total_mass
            center_y = sum(body.y * body.mass for body in self.bodies) / total_mass
            self.camera_x = center_x
            self.camera_y = center_y
        else:
            self.camera_x = 0
            self.camera_y = 0
        self.zoom = 1.0

    # Slider callbacks
    def update_mass(self, sender, app_data):
        self.default_mass = app_data
        if self.selected_body:
            self.selected_body.mass = app_data

    def update_vx(self, sender, app_data):
        self.default_vx = app_data
        if self.selected_body:
            self.selected_body.vx = app_data

    def update_vy(self, sender, app_data):
        self.default_vy = app_data
        if self.selected_body:
            self.selected_body.vy = app_data

    def update_time_scale(self, sender, app_data):
        self.time_scale = app_data

    def update_gravity(self, sender, app_data):
        self.gravity_strength = app_data

    def toggle_collisions(self, sender, app_data):
        self.collision_enabled = app_data

    # Mouse handlers
    def mouse_click_handler(self, sender, app_data):
        mouse_x, mouse_y = dpg.get_mouse_pos()
        
        # Check if click is in simulation area
        if not (PANEL_WIDTH < mouse_x < VIEWPORT_WIDTH and 0 < mouse_y < VIEWPORT_HEIGHT):
            return
            
        # Convert to simulation coordinates
        sim_x = mouse_x - PANEL_WIDTH
        sim_y = mouse_y
        world_x, world_y = self.screen_to_world(sim_x, sim_y)
        
        if app_data == 0:  # Left click
            clicked_body = self.find_body_at_position(world_x, world_y)
            
            if clicked_body:
                # Select the body and start dragging
                self.selected_body = clicked_body
                self.dragging_body = True
                self.drag_offset_x = world_x - clicked_body.x
                self.drag_offset_y = world_y - clicked_body.y
                self.update_sliders_from_body()
            else:
                # Add new body with precise placement
                self.add_body(world_x, world_y)
        
        elif app_data == 1:  # Right click - select body only
            clicked_body = self.find_body_at_position(world_x, world_y)
            if clicked_body:
                self.select_body(clicked_body)
                
        elif app_data == 2:  # Middle click - start panning
            self.panning = True
            self.last_mouse_x = mouse_x
            self.last_mouse_y = mouse_y

    def mouse_release_handler(self, sender, app_data):
        if app_data == 0:  # Left mouse release
            self.dragging_body = False
        elif app_data == 2:  # Middle mouse release
            self.panning = False

    def mouse_move_handler(self, sender, app_data):
        mouse_x, mouse_y = dpg.get_mouse_pos()
        
        # Update mouse position display
        if PANEL_WIDTH < mouse_x < VIEWPORT_WIDTH and 0 < mouse_y < VIEWPORT_HEIGHT:
            sim_x = mouse_x - PANEL_WIDTH
            sim_y = mouse_y
            world_x, world_y = self.screen_to_world(sim_x, sim_y)
            dpg.set_value("mouse_pos", f"Mouse: ({world_x:.1f}, {world_y:.1f})")
        
        # Handle body dragging
        if self.dragging_body and self.selected_body:
            if PANEL_WIDTH < mouse_x < VIEWPORT_WIDTH and 0 < mouse_y < VIEWPORT_HEIGHT:
                sim_x = mouse_x - PANEL_WIDTH
                sim_y = mouse_y
                world_x, world_y = self.screen_to_world(sim_x, sim_y)
                self.selected_body.x = world_x - self.drag_offset_x
                self.selected_body.y = world_y - self.drag_offset_y
                # Clear trail when dragging
                self.selected_body.trail.clear()
        
        # Handle view panning
        if self.panning:
            dx = mouse_x - self.last_mouse_x
            dy = mouse_y - self.last_mouse_y
            
            # Pan the camera (inverse direction for natural feel)
            self.camera_x -= dx / self.zoom
            self.camera_y -= dy / self.zoom
            
            self.last_mouse_x = mouse_x
            self.last_mouse_y = mouse_y

    def mouse_drag_handler(self, sender, app_data):
        # This provides smoother dragging for panning
        if self.panning:
            mouse_x, mouse_y = dpg.get_mouse_pos()
            dx = mouse_x - self.last_mouse_x
            dy = mouse_y - self.last_mouse_y
            
            self.camera_x -= dx / self.zoom
            self.camera_y -= dy / self.zoom
            
            self.last_mouse_x = mouse_x
            self.last_mouse_y = mouse_y

    def mouse_wheel_handler(self, sender, app_data):
        mouse_x, mouse_y = dpg.get_mouse_pos()
        if PANEL_WIDTH < mouse_x < VIEWPORT_WIDTH and 0 < mouse_y < VIEWPORT_HEIGHT:
            # Zoom towards mouse position with smoother scaling
            sim_x = mouse_x - PANEL_WIDTH
            sim_y = mouse_y
            world_x, world_y = self.screen_to_world(sim_x, sim_y)
            
            # Smoother zoom factor
            zoom_factor = 1.15 if app_data > 0 else 1.0 / 1.15
            old_zoom = self.zoom
            self.zoom *= zoom_factor
            self.zoom = max(0.05, min(self.zoom, 20.0))  # Extended zoom range
            
            # Adjust camera to zoom towards mouse with better precision
            zoom_change = self.zoom / old_zoom
            self.camera_x = world_x - (world_x - self.camera_x) * zoom_change
            self.camera_y = world_y - (world_y - self.camera_y) * zoom_change

    def add_body(self, x: float, y: float):
        """Add a new body at the specified position"""
        colors = [(255, 100, 100), (100, 255, 100), (100, 100, 255), 
                 (255, 255, 100), (255, 100, 255), (100, 255, 255), (255, 165, 0)]
        
        body = Body(
            id=self.next_body_id,
            x=x, y=y,
            vx=self.default_vx,
            vy=self.default_vy,
            mass=self.default_mass,
            radius=0,  # Will be calculated based on mass
            color=colors[self.next_body_id % len(colors)],
            trail=[]
        )
        self.bodies.append(body)
        self.next_body_id += 1
        self.select_body(body)

    def select_body(self, body: Body):
        """Select a body and update sliders"""
        self.selected_body = body
        dpg.set_value("mass_slider", body.mass)
        dpg.set_value("vx_slider", body.vx)
        dpg.set_value("vy_slider", body.vy)

    def update_sliders_from_body(self):
        """Update sliders to match selected body properties"""
        if self.selected_body:
            dpg.set_value("mass_slider", min(max(self.selected_body.mass, 1.0), 200.0))
            dpg.set_value("vx_slider", min(max(self.selected_body.vx, -100.0), 100.0))
            dpg.set_value("vy_slider", min(max(self.selected_body.vy, -100.0), 100.0))

    def find_body_at_position(self, x: float, y: float) -> Optional[Body]:
        """Find a body at the given world coordinates with improved precision"""
        for body in reversed(self.bodies):
            dx = x - body.x
            dy = y - body.y
            # Use actual visual radius for more precise hit detection
            hit_radius = max(body.get_display_radius(), 8) / self.zoom  # Scale with zoom
            if (dx * dx + dy * dy) <= hit_radius ** 2:
                return body
        return None

    def run(self):
        """Main application loop"""
        last_time = time.time()
        fps_counter = 0
        fps_timer = time.time()
        
        while dpg.is_dearpygui_running():
            current_time = time.time()
            dt = current_time - last_time
            last_time = current_time
            
            # Update simulation
            if self.simulating and not self.paused:
                self.update_simulation(dt)
            
            # Update UI
            self.update_ui()
            
            # Clear and redraw
            dpg.delete_item("simulation_canvas", children_only=True)
            self.draw_grid()
            self.draw_bodies()
            
            # Update FPS counter
            fps_counter += 1
            if current_time - fps_timer >= 1.0:
                dpg.set_value("fps_display", f"FPS: {fps_counter}")
                fps_counter = 0
                fps_timer = current_time

            dpg.render_dearpygui_frame()

        dpg.destroy_context()

    def update_simulation(self, dt: float):
        """Update the physics simulation"""
        if len(self.bodies) < 1:
            return
        
        # Scale time step
        dt *= self.time_scale
        dt = min(dt, 1/30)  # Cap for stability
        
        # Calculate forces
        self.calculate_forces()
        
        # Update positions and velocities
        for body in self.bodies:
            # Update velocity
            if hasattr(body, 'force_x'):
                ax = body.force_x / body.mass
                ay = body.force_y / body.mass
                body.vx += ax * dt
                body.vy += ay * dt
            
            # Update position
            body.x += body.vx * dt
            body.y += body.vy * dt
            
            # Update trail
            body.trail.append((body.x, body.y))
            if len(body.trail) > body.max_trail_length:
                body.trail.pop(0)

    def calculate_forces(self):
        """Calculate gravitational forces between all bodies"""
        G = 100.0  # Gravitational constant
        MIN_DISTANCE = 20.0
        COLLISION_THRESHOLD = 15.0
        
        # Reset forces
        for body in self.bodies:
            body.force_x = 0
            body.force_y = 0
        
        # Calculate pairwise forces
        bodies_to_remove = []
        for i in range(len(self.bodies)):
            for j in range(i + 1, len(self.bodies)):
                body1 = self.bodies[i]
                body2 = self.bodies[j]
                
                dx = body2.x - body1.x
                dy = body2.y - body1.y
                distance_sq = dx * dx + dy * dy
                
                # Check for collision
                if self.collision_enabled and distance_sq < COLLISION_THRESHOLD ** 2:
                    self.merge_bodies(body1, body2)
                    bodies_to_remove.extend([body1, body2])
                    continue
                
                # Prevent extreme forces
                distance_sq = max(distance_sq, MIN_DISTANCE ** 2)
                distance = math.sqrt(distance_sq)
                
                # Calculate force
                force_magnitude = G * self.gravity_strength * body1.mass * body2.mass / distance_sq
                fx = force_magnitude * dx / distance
                fy = force_magnitude * dy / distance
                
                # Apply forces
                body1.force_x += fx
                body1.force_y += fy
                body2.force_x -= fx
                body2.force_y -= fy
        
        # Remove merged bodies
        for body in bodies_to_remove:
            if body in self.bodies:
                self.bodies.remove(body)

    def merge_bodies(self, body1: Body, body2: Body):
        """Merge two colliding bodies"""
        # Conservation of momentum
        total_mass = body1.mass + body2.mass
        new_vx = (body1.mass * body1.vx + body2.mass * body2.vx) / total_mass
        new_vy = (body1.mass * body1.vy + body2.mass * body2.vy) / total_mass
        
        # Center of mass position
        new_x = (body1.mass * body1.x + body2.mass * body2.x) / total_mass
        new_y = (body1.mass * body1.y + body2.mass * body2.y) / total_mass
        
        # Create new merged body
        merged_body = Body(
            id=self.next_body_id,
            x=new_x, y=new_y,
            vx=new_vx, vy=new_vy,
            mass=total_mass,
            radius=0,
            color=body1.color,  # Keep color of first body
            trail=[]
        )
        self.bodies.append(merged_body)
        self.next_body_id += 1

    def update_ui(self):
        """Update UI elements"""
        dpg.set_value("body_count", f"Bodies: {len(self.bodies)}")

    def draw_grid(self):
        """Draw background grid"""
        grid_size = 50 * self.zoom
        if grid_size < 10:  # Don't draw if too small
            return
        
        # Calculate grid lines
        start_x = -(self.camera_x * self.zoom) % grid_size
        start_y = -(self.camera_y * self.zoom) % grid_size
        
        # Vertical lines
        x = start_x
        while x < SIM_WIDTH:
            dpg.draw_line((x, 0), (x, SIM_HEIGHT), color=(40, 40, 40, 100), thickness=1, parent="simulation_canvas")
            x += grid_size
        
        # Horizontal lines
        y = start_y
        while y < SIM_HEIGHT:
            dpg.draw_line((0, y), (SIM_WIDTH, y), color=(40, 40, 40, 100), thickness=1, parent="simulation_canvas")
            y += grid_size

    def draw_bodies(self):
        """Draw all bodies and their trails"""
        for body in self.bodies:
            # Draw trail
            if len(body.trail) > 1:
                trail_points = []
                for i, (tx, ty) in enumerate(body.trail):
                    screen_x, screen_y = self.world_to_screen(tx, ty)
                    if 0 <= screen_x <= SIM_WIDTH and 0 <= screen_y <= SIM_HEIGHT:
                        trail_points.append([screen_x, screen_y])
                
                if len(trail_points) > 1:
                    # Draw trail as connected lines with fading alpha
                    for i in range(len(trail_points) - 1):
                        alpha = int((i / len(trail_points)) * 100 + 50)
                        color = (*body.color, alpha)
                        dpg.draw_line(trail_points[i], trail_points[i + 1], 
                                    color=color, thickness=2, parent="simulation_canvas")
            
            # Draw body
            screen_x, screen_y = self.world_to_screen(body.x, body.y)
            radius = max(3, body.get_display_radius() * self.zoom)
            
            # Draw selection indicator
            if body == self.selected_body:
                dpg.draw_circle((screen_x, screen_y), radius + 5, 
                              color=(255, 255, 255, 150), thickness=2, parent="simulation_canvas")
            
            # Draw body
            dpg.draw_circle((screen_x, screen_y), radius, 
                          color=body.color, fill=body.color, parent="simulation_canvas")
            
            # Draw velocity vector
            if body == self.selected_body and (body.vx != 0 or body.vy != 0):
                vel_scale = 2.0
                end_x = screen_x + body.vx * vel_scale
                end_y = screen_y + body.vy * vel_scale
                dpg.draw_arrow((screen_x, screen_y), (end_x, end_y), 
                             color=(255, 255, 0), thickness=2, size=10, parent="simulation_canvas")

    def world_to_screen(self, x: float, y: float) -> Tuple[int, int]:
        """Convert world coordinates to screen coordinates"""
        screen_x = int((x - self.camera_x) * self.zoom + SIM_WIDTH // 2)
        screen_y = int((y - self.camera_y) * self.zoom + SIM_HEIGHT // 2)
        return screen_x, screen_y

    def screen_to_world(self, screen_x: int, screen_y: int) -> Tuple[float, float]:
        """Convert screen coordinates to world coordinates"""
        world_x = (screen_x - SIM_WIDTH // 2) / self.zoom + self.camera_x
        world_y = (screen_y - SIM_HEIGHT // 2) / self.zoom + self.camera_y
        return world_x, world_y

if __name__ == "__main__":
    sim = NBodySimulatorDearPyGui()
    sim.run()
