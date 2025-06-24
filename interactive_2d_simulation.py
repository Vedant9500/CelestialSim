"""
Interactive 2D N-Body Simulation
===============================

Click to place bodies, set their properties, and watch them interact in real-time!

Controls:
- Left Click: Place a new body
- Right Click: Select/modify existing body
- Space: Start/Pause simulation
- R: Reset simulation
- C: Clear all bodies
- ESC: Quit

Body Properties (adjustable in side panel):
- Mass
- Velocity X/Y
- Color
- Trail length
"""

import pygame
import math
import sys
from dataclasses import dataclass
from typing import List, Tuple, Optional
import json

# Initialize Pygame
pygame.init()

# Constants
SCREEN_WIDTH = 1200
SCREEN_HEIGHT = 800
PANEL_WIDTH = 300
SIM_WIDTH = SCREEN_WIDTH - PANEL_WIDTH
FPS = 60

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
YELLOW = (255, 255, 0)
PURPLE = (255, 0, 255)
CYAN = (0, 255, 255)
ORANGE = (255, 165, 0)
GRAY = (128, 128, 128)
LIGHT_GRAY = (200, 200, 200)
DARK_GRAY = (64, 64, 64)

BODY_COLORS = [RED, GREEN, BLUE, YELLOW, PURPLE, CYAN, ORANGE]

# Physics constants
G = 100.0  # Gravitational constant (scaled for simulation - more responsive)
MIN_DISTANCE = 20.0  # Minimum distance to prevent extreme forces
COLLISION_THRESHOLD = 15.0  # Distance at which bodies merge

@dataclass
class Body:
    """Represents a gravitational body in the simulation"""
    x: float
    y: float
    vx: float
    vy: float
    mass: float
    radius: float
    color: Tuple[int, int, int]
    trail: List[Tuple[float, float]]
    max_trail_length: int = 50
    force_x: float = 0.0
    force_y: float = 0.0
    
    def __post_init__(self):
        if not self.trail:
            self.trail = []
    
    def update_position(self, dt: float):
        """Update position based on velocity"""
        self.x += self.vx * dt
        self.y += self.vy * dt
        
        # Add to trail
        self.trail.append((self.x, self.y))
        if len(self.trail) > self.max_trail_length:
            self.trail.pop(0)
    
    def apply_force(self, fx: float, fy: float, dt: float):
        """Apply force to update velocity"""
        ax = fx / self.mass
        ay = fy / self.mass
        self.vx += ax * dt
        self.vy += ay * dt
    
    def get_display_radius(self) -> int:
        """Get radius for display (minimum 3 pixels, scales with mass)"""
        return max(3, int(math.sqrt(self.mass / 5) + 2))
    
    def contains_point(self, x: float, y: float) -> bool:
        """Check if point is inside this body"""
        dx = x - self.x
        dy = y - self.y
        return (dx * dx + dy * dy) <= (self.get_display_radius() + 5) ** 2  # Slightly larger hit area

class Slider:
    """Simple slider widget"""
    def __init__(self, x: int, y: int, width: int, height: int, min_val: float, max_val: float, initial_val: float, label: str):
        self.rect = pygame.Rect(x, y, width, height)
        self.min_val = min_val
        self.max_val = max_val
        self.val = initial_val
        self.label = label
        self.dragging = False
        self.font = pygame.font.Font(None, 24)
    
    def handle_event(self, event) -> bool:
        """Handle mouse events, return True if value changed"""
        if event.type == pygame.MOUSEBUTTONDOWN:
            if self.rect.collidepoint(event.pos):
                self.dragging = True
                self.update_value(event.pos[0])
                return True
        elif event.type == pygame.MOUSEBUTTONUP:
            self.dragging = False
        elif event.type == pygame.MOUSEMOTION and self.dragging:
            self.update_value(event.pos[0])
            return True
        return False
    
    def update_value(self, mouse_x: int):
        """Update slider value based on mouse position"""
        relative_x = mouse_x - self.rect.x
        relative_x = max(0, min(relative_x, self.rect.width))
        ratio = relative_x / self.rect.width
        self.val = self.min_val + ratio * (self.max_val - self.min_val)
    
    def draw(self, screen):
        """Draw the slider with improved styling"""
        # Background track
        track_rect = pygame.Rect(self.rect.x, self.rect.y + self.rect.height//3, self.rect.width, self.rect.height//3)
        pygame.draw.rect(screen, (180, 180, 180), track_rect)
        pygame.draw.rect(screen, (120, 120, 120), track_rect, 1)
        
        # Handle position
        ratio = (self.val - self.min_val) / (self.max_val - self.min_val)
        handle_x = self.rect.x + ratio * self.rect.width
        handle_rect = pygame.Rect(handle_x - 8, self.rect.y, 16, self.rect.height)
        
        # Handle shadow
        shadow_rect = pygame.Rect(handle_x - 7, self.rect.y + 1, 16, self.rect.height)
        pygame.draw.rect(screen, (100, 100, 100), shadow_rect)
        
        # Handle
        pygame.draw.rect(screen, (220, 220, 220), handle_rect)
        pygame.draw.rect(screen, (60, 60, 60), handle_rect, 2)
        
        # Label and value
        label_text = self.font.render(f"{self.label}: {self.val:.1f}", True, (50, 50, 50))
        screen.blit(label_text, (self.rect.x, self.rect.y - 25))

class Button:
    """Simple button widget"""
    def __init__(self, x: int, y: int, width: int, height: int, text: str, color: Tuple[int, int, int] = LIGHT_GRAY):
        self.rect = pygame.Rect(x, y, width, height)
        self.text = text
        self.color = color
        self.font = pygame.font.Font(None, 24)
        self.pressed = False
    
    def handle_event(self, event) -> bool:
        """Handle mouse events, return True if clicked"""
        if event.type == pygame.MOUSEBUTTONDOWN:
            if self.rect.collidepoint(event.pos):
                self.pressed = True
                return True
        elif event.type == pygame.MOUSEBUTTONUP:
            self.pressed = False
        return False
    
    def draw(self, screen):
        """Draw the button"""
        color = GRAY if self.pressed else self.color
        pygame.draw.rect(screen, color, self.rect)
        pygame.draw.rect(screen, BLACK, self.rect, 2)
        
        text_surface = self.font.render(self.text, True, BLACK)
        text_rect = text_surface.get_rect(center=self.rect.center)
        screen.blit(text_surface, text_rect)

class NBodySimulator:
    """Main simulation class"""
    
    def __init__(self):
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("Interactive 2D N-Body Simulation")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 28)
        self.small_font = pygame.font.Font(None, 20)
        self.large_font = pygame.font.Font(None, 32)
        
        # Simulation state
        self.bodies: List[Body] = []
        self.selected_body: Optional[Body] = None
        self.running = True
        self.simulating = False
        self.time_scale = 1.0
        self.show_trails = True
        self.show_forces = False
        self.show_info = True
        self.paused = False
        
        # Physics settings
        self.gravity_strength = 1.0
        self.collision_enabled = True
        
        # Default body properties
        self.default_mass = 50.0
        self.default_vx = 0.0
        self.default_vy = 0.0
        self.default_trail_length = 50
        self.color_index = 0
        
        # UI elements
        self.setup_ui()
        
        # Camera and view
        self.camera_x = 0
        self.camera_y = 0
        self.zoom = 1.0
        self.grid_visible = True
        
        # Performance tracking
        self.frame_count = 0
        self.fps_display = 60
        self.last_fps_update = pygame.time.get_ticks()
        
        # UI state
        self.dragging_body = False
        self.drag_offset = (0, 0)
        self.mouse_world_pos = (0, 0)
    
    def setup_ui(self):
        """Setup UI elements in the control panel"""
        panel_x = SIM_WIDTH + 10
        y_offset = 50
        spacing = 70
        
        # Mass slider
        self.mass_slider = Slider(panel_x, y_offset, 200, 20, 1.0, 200.0, self.default_mass, "Mass")
        y_offset += spacing
        
        # Velocity X slider
        self.vx_slider = Slider(panel_x, y_offset, 200, 20, -50.0, 50.0, self.default_vx, "Velocity X")
        y_offset += spacing
        
        # Velocity Y slider
        self.vy_slider = Slider(panel_x, y_offset, 200, 20, -50.0, 50.0, self.default_vy, "Velocity Y")
        y_offset += spacing
        
        # Trail length slider
        self.trail_slider = Slider(panel_x, y_offset, 200, 20, 0, 100, self.default_trail_length, "Trail Length")
        y_offset += spacing
        
        # Time scale slider
        self.time_slider = Slider(panel_x, y_offset, 200, 20, 0.1, 3.0, self.time_scale, "Time Scale")
        y_offset += spacing
        
        # Gravity strength slider
        self.gravity_slider = Slider(panel_x, y_offset, 200, 20, 0.1, 3.0, self.gravity_strength, "Gravity")
        y_offset += spacing + 10
        
        # Buttons
        button_width = 85
        button_height = 35
        button_spacing = 40
        
        self.start_button = Button(panel_x, y_offset, button_width, button_height, "Start", GREEN)
        self.pause_button = Button(panel_x + 90, y_offset, button_width, button_height, "Pause", YELLOW)
        y_offset += button_spacing
        
        self.reset_button = Button(panel_x, y_offset, button_width, button_height, "Reset", ORANGE)
        self.clear_button = Button(panel_x + 90, y_offset, button_width, button_height, "Clear", RED)
        y_offset += button_spacing
        
        self.trails_button = Button(panel_x, y_offset, button_width, button_height, "Trails", CYAN)
        self.grid_button = Button(panel_x + 90, y_offset, button_width, button_height, "Grid", CYAN)
        y_offset += button_spacing
        
        self.save_button = Button(panel_x, y_offset, button_width, button_height, "Save", PURPLE)
        self.load_button = Button(panel_x + 90, y_offset, button_width, button_height, "Load", PURPLE)
    
    def world_to_screen(self, x: float, y: float) -> Tuple[int, int]:
        """Convert world coordinates to screen coordinates"""
        screen_x = int((x - self.camera_x) * self.zoom + SIM_WIDTH // 2)
        screen_y = int((y - self.camera_y) * self.zoom + SCREEN_HEIGHT // 2)
        return screen_x, screen_y
    
    def screen_to_world(self, screen_x: int, screen_y: int) -> Tuple[float, float]:
        """Convert screen coordinates to world coordinates"""
        world_x = (screen_x - SIM_WIDTH // 2) / self.zoom + self.camera_x
        world_y = (screen_y - SCREEN_HEIGHT // 2) / self.zoom + self.camera_y
        return world_x, world_y
    
    def add_body(self, x: float, y: float):
        """Add a new body at the specified position"""
        body = Body(
            x=x, y=y,
            vx=self.vx_slider.val,
            vy=self.vy_slider.val,
            mass=self.mass_slider.val,
            radius=0,  # Will be calculated based on mass
            color=BODY_COLORS[self.color_index % len(BODY_COLORS)],
            trail=[]
        )
        self.bodies.append(body)
        self.color_index += 1
        self.selected_body = body
    
    def find_body_at_position(self, x: float, y: float) -> Optional[Body]:
        """Find a body at the given world coordinates"""
        for body in reversed(self.bodies):  # Check from top to bottom
            if body.contains_point(x, y):
                return body
        return None
    
    def calculate_forces(self):
        """Calculate gravitational forces between all bodies with improved physics"""
        if len(self.bodies) < 2:
            return
            
        # Reset forces
        for body in self.bodies:
            body.force_x = 0
            body.force_y = 0
        
        # Calculate pairwise forces
        for i in range(len(self.bodies)):
            for j in range(i + 1, len(self.bodies)):
                body1 = self.bodies[i]
                body2 = self.bodies[j]
                
                # Calculate distance
                dx = body2.x - body1.x
                dy = body2.y - body1.y
                distance_sq = dx * dx + dy * dy
                
                # Check for collision
                if self.collision_enabled and distance_sq < COLLISION_THRESHOLD ** 2:
                    self.merge_bodies(body1, body2)
                    return  # Restart force calculation after merger
                
                # Prevent extreme forces at small distances
                distance_sq = max(distance_sq, MIN_DISTANCE ** 2)
                distance = math.sqrt(distance_sq)
                
                # Calculate force magnitude
                force_magnitude = G * self.gravity_strength * body1.mass * body2.mass / distance_sq
                
                # Calculate force components
                fx = force_magnitude * dx / distance
                fy = force_magnitude * dy / distance
                
                # Apply forces (Newton's third law)
                body1.force_x += fx
                body1.force_y += fy
                body2.force_x -= fx
                body2.force_y -= fy
        
        # Apply forces to update velocities
        dt = 1.0 / FPS * self.time_scale
        for body in self.bodies:
            if hasattr(body, 'force_x'):
                ax = body.force_x / body.mass
                ay = body.force_y / body.mass
                body.vx += ax * dt
                body.vy += ay * dt
    
    def update_simulation(self):
        """Update the simulation by one time step"""
        if not self.simulating or self.paused or len(self.bodies) < 1:
            return
        
        # Calculate forces and update velocities
        self.calculate_forces()
        
        # Update positions
        dt = 1.0 / FPS * self.time_scale
        for body in self.bodies:
            body.update_position(dt)
        
        # Update FPS counter
        self.update_fps_counter()
    
    def handle_events(self):
        """Handle all input events"""
        keys = pygame.key.get_pressed()
        mouse_pos = pygame.mouse.get_pos()
        
        # Update mouse world position for display
        if mouse_pos[0] < SIM_WIDTH:
            self.mouse_world_pos = self.screen_to_world(mouse_pos[0], mouse_pos[1])
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    if self.simulating:
                        self.paused = not self.paused
                    else:
                        self.simulating = True
                        self.paused = False
                elif event.key == pygame.K_r:
                    self.reset_simulation()
                elif event.key == pygame.K_c:
                    self.clear_all()
                elif event.key == pygame.K_ESCAPE:
                    self.running = False
                elif event.key == pygame.K_t:
                    self.show_trails = not self.show_trails
                elif event.key == pygame.K_g:
                    self.grid_visible = not self.grid_visible
                elif event.key == pygame.K_i:
                    self.show_info = not self.show_info
                elif event.key == pygame.K_DELETE and self.selected_body:
                    if self.selected_body in self.bodies:
                        self.bodies.remove(self.selected_body)
                        self.selected_body = None
            
            elif event.type == pygame.MOUSEBUTTONDOWN:
                mouse_x, mouse_y = event.pos
                
                # Check if click is in simulation area
                if mouse_x < SIM_WIDTH:
                    world_x, world_y = self.screen_to_world(mouse_x, mouse_y)
                    
                    if event.button == 1:  # Left click
                        clicked_body = self.find_body_at_position(world_x, world_y)
                        if clicked_body and keys[pygame.K_LSHIFT]:
                            # Shift+click to drag body
                            self.selected_body = clicked_body
                            self.dragging_body = True
                            self.drag_offset = (world_x - clicked_body.x, world_y - clicked_body.y)
                        elif clicked_body:
                            # Select body
                            self.selected_body = clicked_body
                            self.update_sliders_from_body()
                        else:
                            # Add new body
                            self.add_body(world_x, world_y)
                    
                    elif event.button == 3:  # Right click - select body
                        self.selected_body = self.find_body_at_position(world_x, world_y)
                        if self.selected_body:
                            self.update_sliders_from_body()
            
            elif event.type == pygame.MOUSEBUTTONUP:
                if event.button == 1:
                    self.dragging_body = False
            
            elif event.type == pygame.MOUSEMOTION:
                if self.dragging_body and self.selected_body:
                    mouse_x, mouse_y = event.pos
                    if mouse_x < SIM_WIDTH:
                        world_x, world_y = self.screen_to_world(mouse_x, mouse_y)
                        self.selected_body.x = world_x - self.drag_offset[0]
                        self.selected_body.y = world_y - self.drag_offset[1]
                        # Clear trail when dragging
                        self.selected_body.trail.clear()
            
            elif event.type == pygame.MOUSEWHEEL:
                # Zoom
                mouse_x, mouse_y = pygame.mouse.get_pos()
                if mouse_x < SIM_WIDTH:
                    old_zoom = self.zoom
                    zoom_factor = 1.1 if event.y > 0 else 0.9
                    self.zoom *= zoom_factor
                    self.zoom = max(0.1, min(self.zoom, 10.0))
                    
                    # Adjust camera to zoom towards mouse position
                    world_pos = self.screen_to_world(mouse_x, mouse_y)
                    zoom_change = self.zoom / old_zoom
                    self.camera_x = world_pos[0] - (world_pos[0] - self.camera_x) * zoom_change
                    self.camera_y = world_pos[1] - (world_pos[1] - self.camera_y) * zoom_change
            
            # Handle UI events
            self.handle_slider_events(event)
            self.handle_button_events(event)
    
    def update_sliders_from_body(self):
        """Update sliders to match selected body properties"""
        if self.selected_body:
            self.mass_slider.val = min(max(self.selected_body.mass, self.mass_slider.min_val), self.mass_slider.max_val)
            self.vx_slider.val = min(max(self.selected_body.vx, self.vx_slider.min_val), self.vx_slider.max_val)
            self.vy_slider.val = min(max(self.selected_body.vy, self.vy_slider.min_val), self.vy_slider.max_val)
            self.trail_slider.val = min(max(self.selected_body.max_trail_length, self.trail_slider.min_val), self.trail_slider.max_val)
    
    def handle_slider_events(self, event):
        """Handle slider events"""
        if self.mass_slider.handle_event(event):
            if self.selected_body:
                self.selected_body.mass = self.mass_slider.val
            else:
                self.default_mass = self.mass_slider.val
        
        if self.vx_slider.handle_event(event):
            if self.selected_body:
                self.selected_body.vx = self.vx_slider.val
            else:
                self.default_vx = self.vx_slider.val
        
        if self.vy_slider.handle_event(event):
            if self.selected_body:
                self.selected_body.vy = self.vy_slider.val
            else:
                self.default_vy = self.vy_slider.val
        
        if self.trail_slider.handle_event(event):
            if self.selected_body:
                self.selected_body.max_trail_length = int(self.trail_slider.val)
            else:
                self.default_trail_length = int(self.trail_slider.val)
        
        if self.time_slider.handle_event(event):
            self.time_scale = self.time_slider.val
        
        if self.gravity_slider.handle_event(event):
            self.gravity_strength = self.gravity_slider.val
    
    def handle_button_events(self, event):
        """Handle button click events"""
        if self.start_button.handle_event(event):
            self.simulating = True
            self.paused = False
        
        if self.pause_button.handle_event(event):
            if self.simulating:
                self.paused = not self.paused
        
        if self.reset_button.handle_event(event):
            self.reset_simulation()
        
        if self.clear_button.handle_event(event):
            self.clear_all()
        
        if self.trails_button.handle_event(event):
            self.show_trails = not self.show_trails
        
        if self.grid_button.handle_event(event):
            self.grid_visible = not self.grid_visible
        
        if self.save_button.handle_event(event):
            self.save_configuration()
        
        if self.load_button.handle_event(event):
            self.load_configuration()
    
    def reset_simulation(self):
        """Reset all body positions to initial state and clear trails"""
        for body in self.bodies:
            body.trail.clear()
            body.vx = 0
            body.vy = 0
        self.simulating = False
    
    def clear_all(self):
        """Remove all bodies"""
        self.bodies.clear()
        self.selected_body = None
        self.simulating = False
    
    def save_configuration(self):
        """Save current configuration to file"""
        config = {
            "bodies": [
                {
                    "x": body.x, "y": body.y,
                    "vx": body.vx, "vy": body.vy,
                    "mass": body.mass,
                    "color": body.color,
                    "max_trail_length": body.max_trail_length
                }
                for body in self.bodies
            ],
            "time_scale": self.time_scale,
            "show_trails": self.show_trails
        }
        
        try:
            with open("simulation_config_2d.json", "w") as f:
                json.dump(config, f, indent=2)
            print("Configuration saved to simulation_config_2d.json")
        except Exception as e:
            print(f"Error saving configuration: {e}")
    
    def load_configuration(self):
        """Load configuration from file"""
        try:
            with open("simulation_config_2d.json", "r") as f:
                config = json.load(f)
            
            self.bodies.clear()
            for body_data in config["bodies"]:
                body = Body(
                    x=body_data["x"], y=body_data["y"],
                    vx=body_data["vx"], vy=body_data["vy"],
                    mass=body_data["mass"],
                    radius=0,
                    color=tuple(body_data["color"]),
                    trail=[],
                    max_trail_length=body_data.get("max_trail_length", 50)
                )
                self.bodies.append(body)
            
            self.time_scale = config.get("time_scale", 1.0)
            self.time_slider.val = self.time_scale
            self.show_trails = config.get("show_trails", True)
            self.simulating = False
            
            print("Configuration loaded from simulation_config_2d.json")
        except Exception as e:
            print(f"Error loading configuration: {e}")
    
    def merge_bodies(self, body1: Body, body2: Body):
        """Merge two bodies in a collision (conservation of momentum and mass)"""
        total_mass = body1.mass + body2.mass
        
        # Conservation of momentum
        new_vx = (body1.vx * body1.mass + body2.vx * body2.mass) / total_mass
        new_vy = (body1.vy * body1.mass + body2.vy * body2.mass) / total_mass
        
        # Conservation of position (weighted by mass)
        new_x = (body1.x * body1.mass + body2.x * body2.mass) / total_mass
        new_y = (body1.y * body1.mass + body2.y * body2.mass) / total_mass
        
        # Create new merged body
        merged_body = Body(
            x=new_x, y=new_y,
            vx=new_vx, vy=new_vy,
            mass=total_mass,
            radius=0,
            color=body1.color if body1.mass >= body2.mass else body2.color,
            trail=[],
            max_trail_length=max(body1.max_trail_length, body2.max_trail_length)
        )
        
        # Remove old bodies and add merged body
        if body1 in self.bodies:
            self.bodies.remove(body1)
        if body2 in self.bodies:
            self.bodies.remove(body2)
        self.bodies.append(merged_body)
        
        # Update selection if needed
        if self.selected_body == body1 or self.selected_body == body2:
            self.selected_body = merged_body
    
    def update_fps_counter(self):
        """Update FPS display"""
        current_time = pygame.time.get_ticks()
        self.frame_count += 1
        
        if current_time - self.last_fps_update > 1000:  # Update every second
            self.fps_display = self.frame_count
            self.frame_count = 0
            self.last_fps_update = current_time
    
    def draw_simulation(self):
        """Draw the simulation area with improved graphics"""
        # Clear simulation area
        sim_rect = pygame.Rect(0, 0, SIM_WIDTH, SCREEN_HEIGHT)
        pygame.draw.rect(self.screen, BLACK, sim_rect)
        
        # Draw grid if enabled
        if self.grid_visible:
            grid_spacing = max(20, int(50 * self.zoom))
            grid_color = (40, 40, 40)
            
            # Vertical lines
            start_x = int(-self.camera_x * self.zoom + SIM_WIDTH // 2) % grid_spacing
            for x in range(start_x, SIM_WIDTH, grid_spacing):
                pygame.draw.line(self.screen, grid_color, (x, 0), (x, SCREEN_HEIGHT))
            
            # Horizontal lines
            start_y = int(-self.camera_y * self.zoom + SCREEN_HEIGHT // 2) % grid_spacing
            for y in range(start_y, SCREEN_HEIGHT, grid_spacing):
                pygame.draw.line(self.screen, grid_color, (0, y), (SIM_WIDTH, y))
        
        # Draw center crosshair
        center_x = int(-self.camera_x * self.zoom + SIM_WIDTH // 2)
        center_y = int(-self.camera_y * self.zoom + SCREEN_HEIGHT // 2)
        if 0 <= center_x < SIM_WIDTH and 0 <= center_y < SCREEN_HEIGHT:
            pygame.draw.line(self.screen, (100, 100, 100), (center_x - 10, center_y), (center_x + 10, center_y))
            pygame.draw.line(self.screen, (100, 100, 100), (center_x, center_y - 10), (center_x, center_y + 10))
        
        # Draw trails with improved rendering
        if self.show_trails:
            for body in self.bodies:
                if len(body.trail) > 1:
                    trail_points = []
                    for i, (x, y) in enumerate(body.trail):
                        screen_pos = self.world_to_screen(x, y)
                        if -50 <= screen_pos[0] <= SIM_WIDTH + 50 and -50 <= screen_pos[1] <= SCREEN_HEIGHT + 50:
                            trail_points.append(screen_pos)
                    
                    # Draw trail with fading effect
                    if len(trail_points) > 1:
                        for i in range(1, len(trail_points)):
                            alpha = (i / len(trail_points)) * 0.8
                            color = tuple(int(c * alpha) for c in body.color)
                            thickness = max(1, int(2 * alpha))
                            pygame.draw.line(self.screen, color, trail_points[i-1], trail_points[i], thickness)
        
        # Draw bodies with improved visuals
        for body in self.bodies:
            screen_pos = self.world_to_screen(body.x, body.y)
            if -100 <= screen_pos[0] <= SIM_WIDTH + 100 and -100 <= screen_pos[1] <= SCREEN_HEIGHT + 100:
                radius = max(3, int(body.get_display_radius() * self.zoom))
                
                # Draw glow effect for selected body
                if body == self.selected_body:
                    for i in range(3):
                        glow_radius = radius + 6 - i * 2
                        glow_alpha = 60 - i * 20
                        glow_color = tuple(min(255, c + glow_alpha) for c in WHITE)
                        pygame.draw.circle(self.screen, glow_color, screen_pos, glow_radius, 2)
                
                # Draw body with gradient effect
                pygame.draw.circle(self.screen, body.color, screen_pos, radius)
                
                # Draw highlight
                highlight_pos = (screen_pos[0] - radius//3, screen_pos[1] - radius//3)
                highlight_radius = max(1, radius//3)
                highlight_color = tuple(min(255, c + 80) for c in body.color)
                pygame.draw.circle(self.screen, highlight_color, highlight_pos, highlight_radius)
                
                # Draw outline
                pygame.draw.circle(self.screen, WHITE, screen_pos, radius, 1)
                
                # Draw velocity vector for selected body
                if body == self.selected_body and not self.simulating:
                    vel_scale = 2.0 * self.zoom
                    end_x = screen_pos[0] + body.vx * vel_scale
                    end_y = screen_pos[1] + body.vy * vel_scale
                    if abs(body.vx) > 0.1 or abs(body.vy) > 0.1:
                        pygame.draw.line(self.screen, YELLOW, screen_pos, (int(end_x), int(end_y)), 3)
                        # Draw arrowhead
                        arrow_size = 5
                        angle = math.atan2(body.vy, body.vx)
                        arrow_end = (int(end_x), int(end_y))
                        arrow_p1 = (int(end_x - arrow_size * math.cos(angle - 0.5)), int(end_y - arrow_size * math.sin(angle - 0.5)))
                        arrow_p2 = (int(end_x - arrow_size * math.cos(angle + 0.5)), int(end_y - arrow_size * math.sin(angle + 0.5)))
                        pygame.draw.polygon(self.screen, YELLOW, [arrow_end, arrow_p1, arrow_p2])
        
        # Draw mouse position indicator
        mouse_pos = pygame.mouse.get_pos()
        if mouse_pos[0] < SIM_WIDTH:
            pygame.draw.circle(self.screen, (100, 100, 100), mouse_pos, 3, 1)
        
        # Draw separator line
        pygame.draw.line(self.screen, WHITE, (SIM_WIDTH, 0), (SIM_WIDTH, SCREEN_HEIGHT), 3)
    
    def draw_ui(self):
        """Draw the enhanced control panel"""
        # Clear panel area
        panel_rect = pygame.Rect(SIM_WIDTH, 0, PANEL_WIDTH, SCREEN_HEIGHT)
        pygame.draw.rect(self.screen, (240, 240, 240), panel_rect)
        
        # Draw title bar
        title_rect = pygame.Rect(SIM_WIDTH, 0, PANEL_WIDTH, 40)
        pygame.draw.rect(self.screen, (200, 200, 200), title_rect)
        title_text = self.large_font.render("Control Panel", True, BLACK)
        title_pos = (SIM_WIDTH + 10, 8)
        self.screen.blit(title_text, title_pos)
        
        # Draw current mode indicator
        mode_text = "RUNNING" if self.simulating and not self.paused else "PAUSED" if self.paused else "STOPPED"
        mode_color = GREEN if self.simulating and not self.paused else YELLOW if self.paused else RED
        mode_surface = self.font.render(mode_text, True, mode_color)
        self.screen.blit(mode_surface, (SIM_WIDTH + 180, 12))
        
        # Draw sliders with better styling
        self.mass_slider.draw(self.screen)
        self.vx_slider.draw(self.screen)
        self.vy_slider.draw(self.screen)
        self.trail_slider.draw(self.screen)
        self.time_slider.draw(self.screen)
        self.gravity_slider.draw(self.screen)
        
        # Draw buttons with updated styling
        self.start_button.draw(self.screen)
        self.pause_button.draw(self.screen)
        self.reset_button.draw(self.screen)
        self.clear_button.draw(self.screen)
        self.trails_button.draw(self.screen)
        self.grid_button.draw(self.screen)
        self.save_button.draw(self.screen)
        self.load_button.draw(self.screen)
        
        # Status information
        y_pos = 650
        info_lines = [
            f"Bodies: {len(self.bodies)}",
            f"Selected: {'Yes' if self.selected_body else 'None'}",
            f"FPS: {self.fps_display}",
            f"Zoom: {self.zoom:.1f}x",
            f"Time Scale: {self.time_scale:.1f}x",
            "",
            "CONTROLS:",
            "Left Click: Add/Select body",
            "Shift+Click: Drag body",
            "Right Click: Select body",
            "Mouse Wheel: Zoom",
            "Space: Start/Pause",
            "R: Reset  C: Clear",
            "G: Grid  T: Trails",
            "Del: Delete selected",
            "",
        ]
        
        # Show mouse world coordinates
        if hasattr(self, 'mouse_world_pos'):
            info_lines.append(f"Mouse: ({self.mouse_world_pos[0]:.0f}, {self.mouse_world_pos[1]:.0f})")
        
        # Show selected body info
        if self.selected_body:
            info_lines.extend([
                "",
                "SELECTED BODY:",
                f"Mass: {self.selected_body.mass:.1f}",
                f"Velocity: ({self.selected_body.vx:.1f}, {self.selected_body.vy:.1f})",
                f"Position: ({self.selected_body.x:.0f}, {self.selected_body.y:.0f})",
                f"Speed: {math.sqrt(self.selected_body.vx**2 + self.selected_body.vy**2):.1f}",
            ])
        
        for i, line in enumerate(info_lines):
            color = BLACK if line and not line.startswith(("CONTROLS:", "SELECTED BODY:")) else BLUE
            font = self.small_font if not line.startswith(("CONTROLS:", "SELECTED BODY:")) else self.font
            text = font.render(line, True, color)
            self.screen.blit(text, (SIM_WIDTH + 10, y_pos + i * 16))
        
        # Draw panel border
        pygame.draw.rect(self.screen, BLACK, panel_rect, 2)
    
    def run(self):
        """Main game loop with improved performance"""
        while self.running:
            self.handle_events()
            self.update_simulation()
            
            # Draw everything
            self.screen.fill(WHITE)
            self.draw_simulation()
            self.draw_ui()
            
            pygame.display.flip()
            self.clock.tick(FPS)
        
        pygame.quit()
        sys.exit()

def main():
    """Main function"""
    print("Interactive 2D N-Body Simulation")
    print("=" * 40)
    print("Controls:")
    print("- Left Click: Place a new body")
    print("- Right Click: Select/modify existing body")
    print("- Space: Start/Pause simulation")
    print("- R: Reset simulation")
    print("- C: Clear all bodies")
    print("- Mouse Wheel: Zoom in/out")
    print("- ESC: Quit")
    print()
    print("Use the control panel to adjust body properties!")
    print("3D visualization coming soon...")
    
    simulator = NBodySimulator()
    simulator.run()

if __name__ == "__main__":
    main()
