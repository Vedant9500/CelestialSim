import matplotlib.pyplot as plt
import matplotlib.animation as animation
import pandas as pd
import numpy as np
from mpl_toolkits.mplot3d import Axes3D
from matplotlib.widgets import Button, Slider, CheckButtons
import matplotlib.text as mtext
import time
import os
import sys

class EnhancedNBodyVisualizer:
    def __init__(self):
        self.DATA_FILE = "nbody_realtime_data.csv"
        self.REFRESH_INTERVAL = 50  # milliseconds - faster refresh for smoother animation
        self.TRAIL_LENGTH = 50  # Longer trails
        
        # Create figure with better layout
        self.fig = plt.figure(figsize=(16, 12))
        self.fig.suptitle('Enhanced N-Body Simulation - Real-time Visualization', fontsize=16)
        
        # Main 3D plot
        self.ax_main = plt.subplot2grid((4, 4), (0, 0), rowspan=3, colspan=3, projection='3d')
        
        # Info panel
        self.ax_info = plt.subplot2grid((4, 4), (0, 3), rowspan=2, colspan=1)
        self.ax_info.axis('off')
        
        # Energy plot
        self.ax_energy = plt.subplot2grid((4, 4), (2, 3), colspan=1)
        self.ax_energy.set_title('Energy Conservation')
        self.ax_energy.set_xlabel('Iteration')
        self.ax_energy.set_ylabel('Energy Error (%)')
        
        # Controls
        self.ax_controls = plt.subplot2grid((4, 4), (3, 0), colspan=4)
        self.ax_controls.axis('off')
        
        # Visualization state
        self.colors = []
        self.scatters = []
        self.trails = []
        self.body_data = None
        self.history = []
        self.energy_history = []
        self.iteration_history = []
        
        # Control variables
        self.autoscale = True
        self.center_on_sun = True
        self.display_trails = True
        self.pause_updates = False
        self.show_velocities = False
        self.show_forces = False
        self.follow_body = None
        self.trail_length = 50
        self.point_scale = 1.0
        
        # Info text elements
        self.info_texts = []
        
        self.setup_controls()
        self.setup_3d_plot()
        
    def setup_3d_plot(self):
        """Setup the main 3D plot"""
        self.ax_main.set_xlabel('X (m)')
        self.ax_main.set_ylabel('Y (m)')
        self.ax_main.set_zlabel('Z (m)')
        self.ax_main.set_title('N-Body Simulation (Real-time)')
        
        # Add status text
        self.status_text = self.ax_main.text2D(0.02, 0.98, "Waiting for simulation data...", 
                                              transform=self.ax_main.transAxes, 
                                              verticalalignment='top',
                                              fontsize=10,
                                              bbox=dict(boxstyle="round,pad=0.3", facecolor="white", alpha=0.8))
        
    def setup_controls(self):
        """Setup interactive controls"""
        # Button positions
        button_width = 0.08
        button_height = 0.04
        start_x = 0.05
        start_y = 0.3
        spacing = 0.1
        
        # Create buttons
        self.create_button(start_x, start_y, button_width, button_height, 'Autoscale', self.toggle_autoscale)
        self.create_button(start_x + spacing, start_y, button_width, button_height, 'Center', self.toggle_center)
        self.create_button(start_x + 2*spacing, start_y, button_width, button_height, 'Trails', self.toggle_trails)
        self.create_button(start_x + 3*spacing, start_y, button_width, button_height, 'Pause', self.toggle_pause)
        self.create_button(start_x + 4*spacing, start_y, button_width, button_height, 'Velocities', self.toggle_velocities)
        self.create_button(start_x + 5*spacing, start_y, button_width, button_height, 'Reset View', self.reset_view)
        self.create_button(start_x + 6*spacing, start_y, button_width, button_height, 'Save Data', self.save_current_data)
        
        # Sliders
        slider_y = 0.1
        slider_width = 0.15
        slider_height = 0.03
        
        # Trail length slider
        ax_trail = plt.axes([start_x, slider_y, slider_width, slider_height])
        self.trail_slider = Slider(ax_trail, 'Trail Length', 10, 200, valinit=self.trail_length, valfmt='%d')
        self.trail_slider.on_changed(self.update_trail_length)
        
        # Point scale slider
        ax_scale = plt.axes([start_x + slider_width + 0.05, slider_y, slider_width, slider_height])
        self.scale_slider = Slider(ax_scale, 'Point Scale', 0.1, 5.0, valinit=self.point_scale, valfmt='%.1f')
        self.scale_slider.on_changed(self.update_point_scale)
        
    def create_button(self, x, y, width, height, label, callback):
        """Helper to create buttons"""
        ax = plt.axes([x, y, width, height])
        button = Button(ax, label)
        button.on_clicked(callback)
        return button
        
    def load_realtime_data(self):
        """Load simulation data from CSV file"""
        try:
            data = pd.read_csv(self.DATA_FILE)
            if not data.empty:
                return data
        except (FileNotFoundError, pd.errors.EmptyDataError, pd.errors.ParserError):
            pass
        return None
        
    def init_visualization_objects(self, num_bodies):
        """Initialize visualization objects for a given number of bodies"""
        # Set up color map for different bodies
        self.colors = plt.cm.tab20(np.linspace(0, 1, min(num_bodies, 20)))
        if num_bodies > 20:
            # Extend colors for more bodies
            extra_colors = plt.cm.plasma(np.linspace(0, 1, num_bodies - 20))
            self.colors = np.vstack([self.colors, extra_colors])
        
        # Clear existing objects
        for scatter in self.scatters:
            scatter.remove()
        for trail in self.trails:
            trail.remove()
            
        self.scatters = []
        self.trails = []
        
        # Create new visualization objects
        for i in range(num_bodies):
            # Create scatter plots for bodies
            scatter = self.ax_main.scatter([], [], [], s=50, c=[self.colors[i % len(self.colors)]], alpha=0.8)
            self.scatters.append(scatter)
            
            # Create lines for trails
            trail, = self.ax_main.plot([], [], [], '-', linewidth=1, alpha=0.5, 
                                     c=self.colors[i % len(self.colors)])
            self.trails.append(trail)
        
        # Reset history
        self.history = [[] for _ in range(num_bodies)]
        
    def update_info_panel(self):
        """Update the information panel"""
        self.ax_info.clear()
        self.ax_info.axis('off')
        
        if self.body_data is None:
            return
            
        # System information
        info_text = "System Information\n" + "="*20 + "\n"
        
        active_bodies = self.body_data[self.body_data['active'] == 1]
        total_mass = active_bodies['mass'].sum()
        
        info_text += f"Active Bodies: {len(active_bodies)}\n"
        info_text += f"Total Mass: {total_mass:.2e} kg\n"
        
        if 'total_system_energy' in self.body_data.columns:
            energy = self.body_data['total_system_energy'].iloc[0]
            info_text += f"Total Energy: {energy:.2e} J\n"
            
        if 'energy_error' in self.body_data.columns:
            error = self.body_data['energy_error'].iloc[0] * 100
            info_text += f"Energy Error: {error:.4f}%\n"
            
        if 'iteration' in self.body_data.columns:
            iteration = self.body_data['iteration'].iloc[0]
            info_text += f"Iteration: {iteration}\n"
        
        info_text += "\nBody Details\n" + "="*15 + "\n"
        
        # Show details for up to 10 bodies
        display_bodies = active_bodies.head(10)
        for _, body in display_bodies.iterrows():
            name = body['name'][:8]  # Truncate long names
            mass = body['mass']
            velocity = np.sqrt(body['vx']**2 + body['vy']**2 + body['vz']**2)
            info_text += f"{name}: {mass:.1e} kg\n"
            info_text += f"  v: {velocity:.1e} m/s\n"
        
        if len(active_bodies) > 10:
            info_text += f"... and {len(active_bodies) - 10} more\n"
            
        self.ax_info.text(0.05, 0.95, info_text, transform=self.ax_info.transAxes,
                         verticalalignment='top', fontsize=8, fontfamily='monospace')
        
    def update_energy_plot(self):
        """Update the energy conservation plot"""
        if 'energy_error' not in self.body_data.columns or 'iteration' not in self.body_data.columns:
            return
            
        iteration = self.body_data['iteration'].iloc[0]
        energy_error = self.body_data['energy_error'].iloc[0] * 100
        
        self.iteration_history.append(iteration)
        self.energy_history.append(energy_error)
        
        # Keep only recent history
        max_points = 1000
        if len(self.energy_history) > max_points:
            self.iteration_history = self.iteration_history[-max_points:]
            self.energy_history = self.energy_history[-max_points:]
        
        self.ax_energy.clear()
        self.ax_energy.plot(self.iteration_history, self.energy_history, 'b-', linewidth=1)
        self.ax_energy.set_title('Energy Conservation')
        self.ax_energy.set_xlabel('Iteration')
        self.ax_energy.set_ylabel('Energy Error (%)')
        self.ax_energy.grid(True, alpha=0.3)
        
        if len(self.energy_history) > 0:
            self.ax_energy.set_ylim(min(0, min(self.energy_history)), max(abs(max(self.energy_history)), 1e-10))
        
    def update_visualization(self):
        """Update the main visualization"""
        if self.body_data is None:
            return
            
        # Filter active bodies
        active_data = self.body_data[self.body_data['active'] == 1]
        num_bodies = len(active_data)
        
        if num_bodies == 0:
            return
            
        # Initialize visualization objects if needed
        if not self.scatters or len(self.scatters) != len(self.body_data):
            self.init_visualization_objects(len(self.body_data))
        
        # Get position ranges for scaling
        x_coords = active_data['x'].values
        y_coords = active_data['y'].values
        z_coords = active_data['z'].values
        
        if self.center_on_sun:
            # Center on the most massive body (assumed to be Sun/central body)
            if 'Sun' in active_data['name'].values:
                sun_data = active_data[active_data['name'] == 'Sun']
            else:
                sun_data = active_data.loc[active_data['mass'].idxmax():active_data['mass'].idxmax()]
                
            if not sun_data.empty:
                sun_x, sun_y, sun_z = sun_data['x'].iloc[0], sun_data['y'].iloc[0], sun_data['z'].iloc[0]
                x_coords -= sun_x
                y_coords -= sun_y
                z_coords -= sun_z
        
        # Auto-scale if enabled
        if self.autoscale and len(x_coords) > 0:
            max_range = max(np.ptp(x_coords), np.ptp(y_coords), np.ptp(z_coords)) / 2
            if max_range > 0:
                mid_x, mid_y, mid_z = np.mean(x_coords), np.mean(y_coords), np.mean(z_coords)
                self.ax_main.set_xlim(mid_x - max_range, mid_x + max_range)
                self.ax_main.set_ylim(mid_y - max_range, mid_y + max_range)
                self.ax_main.set_zlim(mid_z - max_range, mid_z + max_range)
        
        # Update body visualizations
        max_mass = active_data['mass'].max()
        min_mass = active_data['mass'].min()
        
        for i, (_, body) in enumerate(self.body_data.iterrows()):
            if not body['active']:
                # Hide inactive bodies
                self.scatters[i]._offsets3d = ([], [], [])
                self.trails[i].set_data([], [])
                self.trails[i].set_3d_properties([])
                continue
                
            x, y, z = body['x'], body['y'], body['z']
            
            # Apply centering
            if self.center_on_sun:
                if 'Sun' in active_data['name'].values:
                    sun_data = active_data[active_data['name'] == 'Sun']
                else:
                    sun_data = active_data.loc[active_data['mass'].idxmax():active_data['mass'].idxmax()]
                    
                if not sun_data.empty:
                    sun_x, sun_y, sun_z = sun_data['x'].iloc[0], sun_data['y'].iloc[0], sun_data['z'].iloc[0]
                    x, y, z = x - sun_x, y - sun_y, z - sun_z
            
            # Update body position
            self.scatters[i]._offsets3d = ([x], [y], [z])
            
            # Update size based on mass
            if max_mass > min_mass:
                rel_size = np.log10(body['mass'] / min_mass) / np.log10(max_mass / min_mass)
            else:
                rel_size = 0.5
            size = (20 + 200 * rel_size) * self.point_scale
            self.scatters[i].set_sizes([size])
            
            # Update trails
            if self.display_trails:
                if i < len(self.history):
                    self.history[i].append((x, y, z))
                    if len(self.history[i]) > self.trail_length:
                        self.history[i] = self.history[i][-self.trail_length:]
                    
                    if self.history[i]:
                        xs, ys, zs = zip(*self.history[i])
                        self.trails[i].set_data(xs, ys)
                        self.trails[i].set_3d_properties(zs)
                        self.trails[i].set_visible(True)
                else:
                    self.trails[i].set_visible(False)
            else:
                self.trails[i].set_visible(False)
        
        # Update legend
        if len(self.ax_main.get_legend_handles_labels()[0]) == 0:
            legend_bodies = active_data.head(min(10, len(active_data)))  # Show up to 10 in legend
            legend_elements = []
            for i, (_, body) in enumerate(legend_bodies.iterrows()):
                color_idx = list(self.body_data.index).index(body.name) if hasattr(body, 'name') else i
                legend_elements.append(plt.Line2D([0], [0], marker='o', color='w',
                                                 label=body['name'],
                                                 markerfacecolor=self.colors[color_idx % len(self.colors)], 
                                                 markersize=8))
            if legend_elements:
                self.ax_main.legend(handles=legend_elements, loc='upper left', bbox_to_anchor=(0, 1))
        
        # Update status
        status = f"Simulating {num_bodies} active bodies"
        if 'iteration' in self.body_data.columns:
            iteration = self.body_data['iteration'].iloc[0]
            status += f" | Iteration: {iteration}"
        self.status_text.set_text(status)
        
    def load_and_update(self):
        """Load latest data and update all visualizations"""
        if self.pause_updates:
            return
            
        new_data = self.load_realtime_data()
        if new_data is not None:
            self.body_data = new_data
            self.update_visualization()
            self.update_info_panel()
            self.update_energy_plot()
    
    def animate(self, frame):
        """Animation callback"""
        self.load_and_update()
        return self.scatters + self.trails
    
    # Control callbacks
    def toggle_autoscale(self, event):
        self.autoscale = not self.autoscale
        
    def toggle_center(self, event):
        self.center_on_sun = not self.center_on_sun
        # Reset trails to avoid jumps
        self.history = [[] for _ in range(len(self.history))]
        
    def toggle_trails(self, event):
        self.display_trails = not self.display_trails
        
    def toggle_pause(self, event):
        self.pause_updates = not self.pause_updates
        
    def toggle_velocities(self, event):
        self.show_velocities = not self.show_velocities
        
    def reset_view(self, event):
        self.ax_main.view_init(elev=20, azim=45)
        
    def save_current_data(self, event):
        if self.body_data is not None:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            filename = f"nbody_snapshot_{timestamp}.csv"
            self.body_data.to_csv(filename, index=False)
            print(f"Data saved to {filename}")
        
    def update_trail_length(self, val):
        self.trail_length = int(val)
        
    def update_point_scale(self, val):
        self.point_scale = val
    
    def start_animation(self):
        """Start the real-time animation"""
        self.ani = animation.FuncAnimation(self.fig, self.animate, 
                                          interval=self.REFRESH_INTERVAL, 
                                          blit=False, cache_frame_data=False)
        
        plt.tight_layout()
        plt.subplots_adjust(bottom=0.15, right=0.75)  # Make room for controls and info
        
        # Add instructions
        instructions = ("Controls: Use buttons and sliders to adjust visualization\n"
                       "Mouse: Rotate 3D view | Scroll: Zoom | Right-click: Pan")
        self.fig.text(0.02, 0.02, instructions, fontsize=8, alpha=0.7)
        
        plt.show()

def main():
    """Main function"""
    print("Enhanced N-Body Visualization")
    print("============================")
    print("Starting enhanced real-time visualization...")
    print("Reading data from 'nbody_realtime_data.csv'")
    print("Make sure the C++ simulation is running.")
    print("\nFeatures:")
    print("- Real-time energy monitoring")
    print("- Interactive controls")
    print("- Collision detection visualization")
    print("- Enhanced trails and scaling")
    print("- Information panel")
    
    try:
        visualizer = EnhancedNBodyVisualizer()
        visualizer.start_animation()
    except KeyboardInterrupt:
        print("\nVisualization stopped by user.")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
